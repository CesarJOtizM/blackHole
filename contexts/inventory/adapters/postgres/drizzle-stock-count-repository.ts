import type { PGlite } from "@electric-sql/pglite";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  countSessionLines,
  countSessions,
  ingredientClassifications,
  ingredients,
  stockBalances,
  stockMovementOutbox,
  stockMovements,
} from "#adapters/postgres/schema.js";
import {
  type IngredientCategory,
  IngredientClassification,
} from "#application/ports/ingredient-classification.js";
import {
  COUNT_LINE_ROLE,
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountLineRole,
  type CountSession,
  type CountSessionStatus,
  StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { STOCK_MOVEMENT_LANE } from "#application/ports/stock-movement-queue.js";
import { type MovementType, onHandDelta } from "#domain/stock-ledger.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MovementRow = typeof stockMovements.$inferSelect;

const CATALOG_BRAND_ID = "brand_catalog";
const CATALOG_VERSION = 1;
const CATALOG_BASE_UNIT = "g";

const inTenant = async <T>(
  database: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE inventory_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );

    return work(tx);
  });

const lineFromRow = (row: MovementRow): CountLedgerLine => ({
  id: row.id,
  tenantId: row.tenantId,
  venueId: row.venueId,
  locationId: row.locationId,
  ingredientId: row.ingredientId,
  quantity: row.quantity,
  unitCost: row.unitCost,
  type: row.movementType as MovementType,
  reference: row.reference,
  occurredAt: row.occurredAt,
  orderLineId: row.orderLineId,
  role: row.role as CountLineRole,
  recipeVersion: row.recipeVersion,
  reason: row.reason,
  actorId: row.actorId,
  ...(row.reversesMovementId === null
    ? {}
    : { reversesMovementId: row.reversesMovementId }),
});

const chronological = (lines: readonly CountLedgerLine[]): CountLedgerLine[] =>
  lines.toSorted((left, right) => {
    const byTime = left.occurredAt.localeCompare(right.occurredAt);

    if (byTime !== 0) {
      return byTime;
    }

    return left.id.localeCompare(right.id);
  });

const sameTenant = (lines: readonly CountLedgerLine[]): string => {
  const tenantId = lines[0]?.tenantId;

  if (tenantId === undefined) {
    throw new Error("A count append belongs to one tenant.");
  }

  if (lines.some((line) => line.tenantId !== tenantId)) {
    throw new Error("A count append belongs to one tenant.");
  }

  return tenantId;
};

export class DrizzleStockCountRepository extends StockCountRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async movementsAt(
    tenantId: string,
    venueId: string,
    locationId: string,
  ): Promise<readonly CountLedgerLine[]> {
    return inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.venueId, venueId),
            eq(stockMovements.locationId, locationId),
          ),
        )
        .orderBy(asc(stockMovements.position));

      return rows.map(lineFromRow);
    });
  }

  override async appendAdjustments(
    lines: readonly CountLedgerLine[],
  ): Promise<void> {
    if (lines.length === 0) {
      return;
    }

    const tenantId = sameTenant(lines);
    const retryable = lines.every((line) => postsDocumentBalance(line.role));

    try {
      await postAdjustments(this.database, tenantId, lines, false);
    } catch (error: unknown) {
      if (!retryable || !isDocumentLineConflict(error)) {
        throw error;
      }

      await postAdjustments(this.database, tenantId, lines, true);
    }
  }

  override async saveSession(session: CountSession): Promise<void> {
    await inTenant(this.database, session.tenantId, async (tx) => {
      await tx
        .insert(countSessions)
        .values({
          tenantId: session.tenantId,
          documentId: session.documentId,
          venueId: session.venueId,
          locationId: session.locationId,
          cutOff: session.cutOff,
          status: session.status,
          valueCop: session.valueCop,
        })
        .onConflictDoUpdate({
          target: [countSessions.tenantId, countSessions.documentId],
          set: {
            venueId: session.venueId,
            locationId: session.locationId,
            cutOff: session.cutOff,
            status: session.status,
            valueCop: session.valueCop,
          },
        });
      await tx
        .delete(countSessionLines)
        .where(
          and(
            eq(countSessionLines.tenantId, session.tenantId),
            eq(countSessionLines.documentId, session.documentId),
          ),
        );

      if (session.lines.length === 0) {
        return;
      }

      await tx.insert(countSessionLines).values(
        session.lines.map((line, index) => ({
          tenantId: session.tenantId,
          documentId: session.documentId,
          position: index + 1,
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          averageCost: line.averageCost,
          valueCop: line.valueCop,
        })),
      );
    });
  }

  async sessionOf(
    tenantId: string,
    documentId: string,
  ): Promise<CountSession | null> {
    return inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(countSessions)
        .where(
          and(
            eq(countSessions.tenantId, tenantId),
            eq(countSessions.documentId, documentId),
          ),
        )
        .limit(1);
      const session = rows[0];

      if (session === undefined) {
        return null;
      }

      const lines = await tx
        .select()
        .from(countSessionLines)
        .where(
          and(
            eq(countSessionLines.tenantId, tenantId),
            eq(countSessionLines.documentId, documentId),
          ),
        )
        .orderBy(asc(countSessionLines.position));

      return {
        tenantId: session.tenantId,
        venueId: session.venueId,
        locationId: session.locationId,
        documentId: session.documentId,
        cutOff: session.cutOff,
        status: session.status as CountSessionStatus,
        lines: lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          averageCost: line.averageCost,
          valueCop: line.valueCop,
        })),
        valueCop: session.valueCop,
      };
    });
  }

  async stockOf(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.locationId, locationId),
            eq(stockMovements.ingredientId, ingredientId),
          ),
        );
      const lines = chronological(rows.map(lineFromRow));
      let onHand = 0;
      const prior: CountLedgerLine[] = [];

      for (const line of lines) {
        onHand += onHandDelta(line, prior);
        prior.push(line);
      }

      return onHand;
    });
  }

  async seed(line: CountLedgerLine): Promise<void> {
    await inTenant(this.database, line.tenantId, async (tx) => {
      const position = await nextPosition(tx);
      await insertMovement(tx, line, position);
    });
  }

  // Rejection keeps the frozen session and does not append a stock line.
  async reject(tenantId: string, documentId: string): Promise<void> {
    await inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select({ status: countSessions.status })
        .from(countSessions)
        .where(
          and(
            eq(countSessions.tenantId, tenantId),
            eq(countSessions.documentId, documentId),
          ),
        )
        .limit(1);
      const session = rows[0];

      if (
        session === undefined ||
        session.status !== COUNT_SESSION_STATUS.PENDING
      ) {
        return;
      }
    });
  }
}

export class DrizzleIngredientClassification extends IngredientClassification {
  private readonly database: Database;

  private pending: Promise<void> = Promise.resolve();

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  // The shared contract calls know before the next awaited port method.
  know(tenantId: string, ingredientId: string): void {
    this.pending = this.pending.then(() =>
      this.remember(tenantId, ingredientId),
    );
  }

  override async ingredientOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<string | null> {
    await this.pending;

    return inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(
          and(
            eq(ingredients.tenantId, tenantId),
            eq(ingredients.id, ingredientId),
          ),
        )
        .limit(1);

      return rows[0]?.id ?? null;
    });
  }

  override async save(category: IngredientCategory): Promise<void> {
    await this.pending;
    await inTenant(this.database, category.tenantId, async (tx) => {
      await tx
        .insert(ingredientClassifications)
        .values({
          tenantId: category.tenantId,
          ingredientId: category.ingredientId,
          category: category.category,
        })
        .onConflictDoUpdate({
          target: [
            ingredientClassifications.tenantId,
            ingredientClassifications.ingredientId,
          ],
          set: { category: category.category },
        });
    });
  }

  override async find(
    tenantId: string,
    ingredientId: string,
  ): Promise<IngredientCategory | null> {
    await this.pending;

    return inTenant(this.database, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(ingredientClassifications)
        .where(
          and(
            eq(ingredientClassifications.tenantId, tenantId),
            eq(ingredientClassifications.ingredientId, ingredientId),
          ),
        )
        .limit(1);
      const stored = rows[0];

      if (stored === undefined) {
        return null;
      }

      return {
        tenantId: stored.tenantId,
        ingredientId: stored.ingredientId,
        category: stored.category,
      };
    });
  }

  private async remember(
    tenantId: string,
    ingredientId: string,
  ): Promise<void> {
    await inTenant(this.database, tenantId, async (tx) => {
      await tx
        .insert(ingredients)
        .values({
          tenantId,
          brandId: CATALOG_BRAND_ID,
          version: CATALOG_VERSION,
          id: ingredientId,
          name: ingredientId,
          baseUnit: CATALOG_BASE_UNIT,
          referenceCostCop: 0,
        })
        .onConflictDoNothing();
    });
  }
}

const nextPosition = async (tx: Transaction): Promise<number> => {
  const rows = await tx
    .select({ position: stockMovements.position })
    .from(stockMovements)
    .orderBy(desc(stockMovements.position))
    .limit(1);

  return (rows[0]?.position ?? 0) + 1;
};

const postsDocumentBalance = (role: string): boolean =>
  role === COUNT_LINE_ROLE.OPERATIONAL_WASTE ||
  role === COUNT_LINE_ROLE.COUNT_ADJUSTMENT;

const isDocumentLineConflict = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as {
      code?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    const namesThisLine =
      record.constraint === "stock_movements_line" ||
      record.message?.includes("stock_movements_line") === true;

    if (record.code === "23505" && namesThisLine) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const documentLineStored = async (
  tx: Transaction,
  line: CountLedgerLine,
): Promise<boolean> => {
  const rows = await tx
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, line.tenantId),
        eq(stockMovements.orderLineId, line.orderLineId),
        eq(stockMovements.role, line.role),
        eq(stockMovements.ingredientId, line.ingredientId),
      ),
    )
    .limit(1);

  return rows[0] !== undefined;
};

const postAdjustments = async (
  database: Database,
  tenantId: string,
  lines: readonly CountLedgerLine[],
  skipExisting: boolean,
): Promise<void> => {
  await inTenant(database, tenantId, async (tx) => {
    let position = await nextPosition(tx);
    let queuedPosition = await nextOutboxPosition(tx);

    for (const line of lines) {
      if (skipExisting && (await documentLineStored(tx, line))) {
        continue;
      }

      await insertMovement(tx, line, position);
      position += 1;

      if (!postsDocumentBalance(line.role)) {
        continue;
      }

      await addDocumentBalance(tx, line);
      await insertDocumentOutbox(tx, line, queuedPosition);
      queuedPosition += 1;
    }
  });
};

const nextOutboxPosition = async (tx: Transaction): Promise<number> => {
  const rows = await tx
    .select({ position: stockMovementOutbox.position })
    .from(stockMovementOutbox)
    .orderBy(desc(stockMovementOutbox.position))
    .limit(1);

  return (rows[0]?.position ?? 0) + 1;
};

const addDocumentBalance = async (
  tx: Transaction,
  line: CountLedgerLine,
): Promise<void> => {
  const rows = await tx
    .select({ quantity: stockBalances.quantity })
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.tenantId, line.tenantId),
        eq(stockBalances.locationId, line.locationId),
        eq(stockBalances.ingredientId, line.ingredientId),
      ),
    );
  const row = rows[0];

  if (row === undefined) {
    await tx.insert(stockBalances).values({
      tenantId: line.tenantId,
      locationId: line.locationId,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
    });
    return;
  }

  await tx
    .update(stockBalances)
    .set({ quantity: row.quantity + line.quantity })
    .where(
      and(
        eq(stockBalances.tenantId, line.tenantId),
        eq(stockBalances.locationId, line.locationId),
        eq(stockBalances.ingredientId, line.ingredientId),
      ),
    );
};

const insertDocumentOutbox = async (
  tx: Transaction,
  line: CountLedgerLine,
  position: number,
): Promise<void> => {
  await tx.insert(stockMovementOutbox).values({
    tenantId: line.tenantId,
    movementId: line.id,
    position,
    lane: STOCK_MOVEMENT_LANE,
    venueId: line.venueId,
    locationId: line.locationId,
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.unitCost,
    movementType: line.type,
    orderLineId: line.orderLineId,
    recipeVersion: line.recipeVersion,
    occurredAt: line.occurredAt,
    role: line.role,
  });
};

const insertMovement = async (
  tx: Transaction,
  line: CountLedgerLine,
  position: number,
): Promise<void> => {
  await tx.insert(stockMovements).values({
    tenantId: line.tenantId,
    id: line.id,
    position,
    venueId: line.venueId,
    locationId: line.locationId,
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.unitCost,
    movementType: line.type,
    reference: line.reference,
    occurredAt: line.occurredAt,
    orderLineId: line.orderLineId,
    role: line.role,
    recipeVersion: line.recipeVersion,
    reason: line.reason,
    actorId: line.actorId,
    reversesMovementId: line.reversesMovementId ?? null,
  });
};
