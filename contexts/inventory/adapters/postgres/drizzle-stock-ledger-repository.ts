import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  negativeStockAlerts,
  pointOfSaleLocations,
  stockBalances,
  stockMovementOutbox,
  stockMovements,
} from "#adapters/postgres/schema.js";
import { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import {
  type AppendStock,
  type ConsumptionRole,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  type StockMovedEvent,
  type StockMovementEnvelope,
  StockMovementQueue,
} from "#application/ports/stock-movement-queue.js";
import type { MovementType } from "#domain/stock-ledger.js";

const INSERT_FAILED = "The stock movement insert failed.";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MovementRow = typeof stockMovements.$inferSelect;
type OutboxRow = typeof stockMovementOutbox.$inferSelect;

const lineFromRow = (row: MovementRow): LedgerLine => ({
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
  role: row.role as ConsumptionRole,
  recipeVersion: row.recipeVersion,
  reason: row.reason,
  actorId: row.actorId,
  ...(row.reversesMovementId === null
    ? {}
    : { reversesMovementId: row.reversesMovementId }),
});

const eventFromRow = (row: OutboxRow): StockMovedEvent => {
  if (row.lane !== STOCK_MOVEMENT_LANE) {
    throw new Error("Stock movements queue on the after_sales lane.");
  }

  return {
    type: "StockMoved",
    movementId: row.movementId,
    tenantId: row.tenantId,
    venueId: row.venueId,
    locationId: row.locationId,
    ingredientId: row.ingredientId,
    quantity: row.quantity,
    unitCost: row.unitCost,
    movementType: row.movementType as MovementType,
    orderLineId: row.orderLineId,
    recipeVersion: row.recipeVersion,
    occurredAt: row.occurredAt,
    role: row.role as ConsumptionRole,
  };
};

const envelopeFromRow = (row: OutboxRow): StockMovementEnvelope => ({
  lane: STOCK_MOVEMENT_LANE,
  key: row.movementId,
  event: eventFromRow(row),
});

const tenantOf = (input: AppendStock): string | null => {
  const tenantId = input.movements[0]?.tenantId ?? input.alerts[0]?.tenantId;

  if (tenantId === undefined) {
    return null;
  }

  const foreignMovement = input.movements.some(
    (movement) => movement.tenantId !== tenantId,
  );
  const foreignAlert = input.alerts.some(
    (alert) => alert.tenantId !== tenantId,
  );

  if (foreignMovement || foreignAlert) {
    throw new Error("A stock append belongs to one tenant.");
  }

  return tenantId;
};

export class DrizzleStockLedgerRepository extends StockLedgerRepository {
  private readonly database: Database;
  private failAt: number | null = null;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  override async findLine(
    tenantId: string,
    orderLineId: string,
    role: ConsumptionRole,
  ): Promise<readonly LedgerLine[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.orderLineId, orderLineId),
            eq(stockMovements.role, role),
          ),
        )
        .orderBy(asc(stockMovements.position));

      return rows.map(lineFromRow);
    });
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({ quantity: stockBalances.quantity })
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.tenantId, tenantId),
            eq(stockBalances.locationId, locationId),
            eq(stockBalances.ingredientId, ingredientId),
          ),
        );

      return row?.quantity ?? 0;
    });
  }

  override async hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ ingredientId: negativeStockAlerts.ingredientId })
        .from(negativeStockAlerts)
        .where(
          and(
            eq(negativeStockAlerts.tenantId, tenantId),
            eq(negativeStockAlerts.locationId, locationId),
            eq(negativeStockAlerts.ingredientId, ingredientId),
          ),
        )
        .limit(1);

      return rows.length === 1;
    });
  }

  override async append(input: AppendStock): Promise<void> {
    const tenantId = tenantOf(input);

    if (tenantId === null) {
      return;
    }

    const failAt = this.failAt;
    this.failAt = null;

    await this.inTenant(tenantId, async (tx) => {
      let position = await nextMovementPosition(tx);
      let queuedPosition = await nextQueuedPosition(tx);

      for (const [index, movement] of input.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(INSERT_FAILED);
        }

        await tx.insert(stockMovements).values({
          tenantId: movement.tenantId,
          id: movement.id,
          position,
          venueId: movement.venueId,
          locationId: movement.locationId,
          ingredientId: movement.ingredientId,
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          movementType: movement.type,
          reference: movement.reference,
          occurredAt: movement.occurredAt,
          orderLineId: movement.orderLineId,
          role: movement.role,
          recipeVersion: movement.recipeVersion,
          reason: movement.reason,
          actorId: movement.actorId,
          reversesMovementId: movement.reversesMovementId ?? null,
        });
        position += 1;
        await addBalance(tx, movement);
        await tx.insert(stockMovementOutbox).values({
          tenantId: movement.tenantId,
          movementId: movement.id,
          position: queuedPosition,
          lane: STOCK_MOVEMENT_LANE,
          venueId: movement.venueId,
          locationId: movement.locationId,
          ingredientId: movement.ingredientId,
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          movementType: movement.type,
          orderLineId: movement.orderLineId,
          recipeVersion: movement.recipeVersion,
          occurredAt: movement.occurredAt,
          role: movement.role,
        });
        queuedPosition += 1;
      }

      for (const alert of input.alerts) {
        await tx.insert(negativeStockAlerts).values({
          tenantId: alert.tenantId,
          venueId: alert.venueId,
          locationId: alert.locationId,
          ingredientId: alert.ingredientId,
          balance: alert.balance,
          occurredAt: alert.occurredAt,
        });
      }
    });
  }

  async queued(tenantId: string): Promise<readonly StockMovementEnvelope[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(stockMovementOutbox)
        .where(eq(stockMovementOutbox.tenantId, tenantId))
        .orderBy(asc(stockMovementOutbox.position));

      return rows.map(envelopeFromRow);
    });
  }

  async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    if (envelope.lane !== STOCK_MOVEMENT_LANE) {
      throw new Error("Stock movements queue on the after_sales lane.");
    }

    if (envelope.key !== envelope.event.movementId) {
      throw new Error("The stock movement queue key is the movement id.");
    }

    await this.inTenant(envelope.event.tenantId, async (tx) => {
      const [existing] = await tx
        .select({ movementId: stockMovementOutbox.movementId })
        .from(stockMovementOutbox)
        .where(
          and(
            eq(stockMovementOutbox.tenantId, envelope.event.tenantId),
            eq(stockMovementOutbox.movementId, envelope.key),
          ),
        )
        .limit(1);

      if (existing !== undefined) {
        return;
      }

      const position = await nextQueuedPosition(tx);
      const event = envelope.event;

      await tx.insert(stockMovementOutbox).values({
        tenantId: event.tenantId,
        movementId: event.movementId,
        position,
        lane: envelope.lane,
        venueId: event.venueId,
        locationId: event.locationId,
        ingredientId: event.ingredientId,
        quantity: event.quantity,
        unitCost: event.unitCost,
        movementType: event.movementType,
        orderLineId: event.orderLineId,
        recipeVersion: event.recipeVersion,
        occurredAt: event.occurredAt,
        role: event.role,
      });
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

export class DrizzleStockMovementQueue extends StockMovementQueue {
  constructor(private readonly ledger: DrizzleStockLedgerRepository) {
    super();
  }

  override async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    await this.ledger.enqueue(envelope);
  }
}

export class DrizzlePointOfSaleDirectory extends PointOfSaleDirectory {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  async remember(
    tenantId: string,
    venueId: string,
    locationId: string,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      await tx.insert(pointOfSaleLocations).values({
        tenantId,
        venueId,
        locationId,
      });
    });
  }

  override async locationOf(
    tenantId: string,
    venueId: string,
  ): Promise<string> {
    return this.inTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({ locationId: pointOfSaleLocations.locationId })
        .from(pointOfSaleLocations)
        .where(
          and(
            eq(pointOfSaleLocations.tenantId, tenantId),
            eq(pointOfSaleLocations.venueId, venueId),
          ),
        );

      if (row === undefined) {
        throw new Error("The venue has no point-of-sale location.");
      }

      return row.locationId;
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

const nextMovementPosition = async (tx: Transaction): Promise<number> => {
  const [row] = await tx
    .select({
      value: sql<number>`coalesce(max(${stockMovements.position}), 0)`,
    })
    .from(stockMovements);

  return Number(row?.value ?? 0) + 1;
};

const nextQueuedPosition = async (tx: Transaction): Promise<number> => {
  const [row] = await tx
    .select({
      value: sql<number>`coalesce(max(${stockMovementOutbox.position}), 0)`,
    })
    .from(stockMovementOutbox);

  return Number(row?.value ?? 0) + 1;
};

const addBalance = async (
  tx: Transaction,
  movement: LedgerLine,
): Promise<void> => {
  const [row] = await tx
    .select({ quantity: stockBalances.quantity })
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.tenantId, movement.tenantId),
        eq(stockBalances.locationId, movement.locationId),
        eq(stockBalances.ingredientId, movement.ingredientId),
      ),
    );

  if (row === undefined) {
    await tx.insert(stockBalances).values({
      tenantId: movement.tenantId,
      locationId: movement.locationId,
      ingredientId: movement.ingredientId,
      quantity: movement.quantity,
    });
    return;
  }

  await tx
    .update(stockBalances)
    .set({ quantity: row.quantity + movement.quantity })
    .where(
      and(
        eq(stockBalances.tenantId, movement.tenantId),
        eq(stockBalances.locationId, movement.locationId),
        eq(stockBalances.ingredientId, movement.ingredientId),
      ),
    );
};
