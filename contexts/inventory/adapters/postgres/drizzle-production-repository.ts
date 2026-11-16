import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  negativeStockAlerts,
  preparationStandardCosts,
  productionCostPolicies,
  productionRuns,
} from "#adapters/postgres/schema.js";
import type {
  AppendProduction,
  AppendProductionCompensation,
  ProductionCostPolicy,
  ProductionStockLine,
  RecordedProductionRun,
  SaveProductionCostPolicy,
} from "#application/ports/production-repository.js";
import { ProductionRepository } from "#application/ports/production-repository.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const INSERT_FAILED = "The production output insert failed.";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type RunRow = typeof productionRuns.$inferSelect;
type StoredMovement = ProductionStockLine & { reversesMovementId?: string };

interface BalanceRow {
  quantity: number | string;
  average_cost: number | string;
}

interface MovementRow {
  id: string;
  venue_id: string;
  location_id: string;
  ingredient_id: string;
  quantity: number | string;
  unit_cost: number | string;
  movement_type: string;
  reference: string;
  occurred_at: string;
  actor_id: string | null;
  recipe_version: number | string | null;
  reverses_movement_id: string | null;
}

interface CountRow {
  position?: number | string;
  count?: number | string;
}

const rowsOf = <T>(result: unknown): T[] => {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    result !== null &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as T[];
  }

  return [];
};

const asNumber = (value: number | string): number => Number(value);

const reversesOf = (movement: StoredMovement): string | null =>
  movement.reversesMovementId ?? null;

const movementFrom = (tenantId: string, row: MovementRow): StoredMovement => {
  const type = row.movement_type;
  const recipeVersion = row.recipe_version;
  const actorId = row.actor_id;

  if (
    (type !== MOVEMENT_TYPE.PRODUCTION_CONSUMPTION &&
      type !== MOVEMENT_TYPE.PRODUCTION_OUTPUT) ||
    recipeVersion === null ||
    actorId === null
  ) {
    throw new Error("Stored production movement is not recognized.");
  }

  return {
    id: row.id,
    tenantId,
    venueId: row.venue_id,
    locationId: row.location_id,
    ingredientId: row.ingredient_id,
    quantity: asNumber(row.quantity),
    unitCost: asNumber(row.unit_cost),
    type,
    reference: row.reference,
    occurredAt: row.occurred_at,
    actorId,
    orderLineId: null,
    role: null,
    recipeVersion: asNumber(recipeVersion),
    ...(row.reverses_movement_id === null
      ? {}
      : { reversesMovementId: row.reverses_movement_id }),
  };
};

export class DrizzleProductionRepository extends ProductionRepository {
  private readonly database: Database;
  private failAt: number | null = null;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  seedHolding(input: {
    tenantId: string;
    locationId: string;
    ingredientId: string;
    quantity: number;
    averageCost: number;
  }): Promise<void> {
    return this.inTenant(input.tenantId, async (tx) => {
      await tx.execute(sql`
        INSERT INTO stock_balances (
          tenant_id,
          location_id,
          ingredient_id,
          quantity,
          average_cost
        )
        VALUES (
          ${input.tenantId},
          ${input.locationId},
          ${input.ingredientId},
          ${input.quantity},
          ${input.averageCost}
        )
        ON CONFLICT (tenant_id, location_id, ingredient_id) DO UPDATE SET
          quantity = excluded.quantity,
          average_cost = excluded.average_cost
      `);
    });
  }

  productionMovements(tenantId: string): Promise<readonly StoredMovement[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = rowsOf<MovementRow>(
        await tx.execute(sql`
          SELECT
            id,
            venue_id,
            location_id,
            ingredient_id,
            quantity,
            unit_cost,
            movement_type,
            reference,
            occurred_at,
            actor_id,
            recipe_version,
            reverses_movement_id
          FROM stock_movements
          WHERE tenant_id = ${tenantId}
            AND (
              movement_type = ${MOVEMENT_TYPE.PRODUCTION_CONSUMPTION}
              OR movement_type = ${MOVEMENT_TYPE.PRODUCTION_OUTPUT}
            )
          ORDER BY position
        `),
      );

      return rows.map((row) => movementFrom(tenantId, row));
    });
  }

  outboxCount(tenantId: string): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const [row] = rowsOf<CountRow>(
        await tx.execute(sql`
          SELECT count(*) AS count
          FROM stock_movement_outbox
          WHERE tenant_id = ${tenantId}
        `),
      );

      return asNumber(row?.count ?? 0);
    });
  }

  override async findRun(
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null> {
    return this.inTenant(tenantId, (tx) => this.readRun(tx, tenantId, runId));
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const holding = await this.holding(
        tx,
        tenantId,
        locationId,
        ingredientId,
      );
      return holding.quantity;
    });
  }

  override async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const holding = await this.holding(
        tx,
        tenantId,
        locationId,
        ingredientId,
      );
      return holding.averageCost;
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

      return rows.length > 0;
    });
  }

  override async policyFor(
    tenantId: string,
    recipeId: string,
  ): Promise<ProductionCostPolicy | null> {
    return this.inTenant(tenantId, async (tx) => {
      const policies = await tx
        .select()
        .from(productionCostPolicies)
        .where(eq(productionCostPolicies.tenantId, tenantId))
        .limit(1);
      const policy = policies[0];

      if (policy === undefined) {
        return null;
      }

      const costs = await tx
        .select()
        .from(preparationStandardCosts)
        .where(
          and(
            eq(preparationStandardCosts.tenantId, tenantId),
            eq(preparationStandardCosts.recipeId, recipeId),
          ),
        )
        .limit(1);

      return {
        costRule: policy.costRule as ProductionCostPolicy["costRule"],
        standardUnitCost: costs[0]?.standardUnitCost ?? null,
      };
    });
  }

  override async append(input: AppendProduction): Promise<void> {
    const failAt = this.failAt;
    this.failAt = null;

    await this.inTenant(input.run.tenantId, async (tx) => {
      const existing = await this.readRun(
        tx,
        input.run.tenantId,
        input.run.runId,
      );

      if (existing) {
        return;
      }

      await tx.insert(productionRuns).values({
        tenantId: input.run.tenantId,
        id: input.run.runId,
        venueId: input.run.venueId,
        locationId: input.run.locationId,
        recipeId: input.run.recipeId,
        recipeVersion: input.run.recipeVersion,
        expectedQuantity: input.run.expectedQuantity,
        actualQuantity: input.run.actualQuantity,
        variance: input.run.variance,
        outputUnitCost: input.run.outputUnitCost,
      });

      let position = await this.nextPosition(tx);

      for (const [index, movement] of input.run.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(INSERT_FAILED);
        }

        await this.postMovement(tx, movement, position);
        position += 1;
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

  override async findCompensation(
    tenantId: string,
    originalRunId: string,
  ): Promise<AppendProductionCompensation | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = rowsOf<MovementRow>(
        await tx.execute(sql`
          SELECT
            id,
            venue_id,
            location_id,
            ingredient_id,
            quantity,
            unit_cost,
            movement_type,
            reference,
            occurred_at,
            actor_id,
            recipe_version,
            reverses_movement_id
          FROM stock_movements
          WHERE tenant_id = ${tenantId}
            AND reverses_movement_id IS NOT NULL
            AND reverses_movement_id IN (
              SELECT id
              FROM stock_movements
              WHERE tenant_id = ${tenantId}
                AND reference = ${originalRunId}
                AND reverses_movement_id IS NULL
            )
          ORDER BY position
        `),
      );
      const first = rows[0];

      if (first === undefined) {
        return null;
      }

      return {
        tenantId,
        originalRunId,
        correctionRunId: first.reference,
        movements: rows.map((row) => {
          const movement = movementFrom(tenantId, row);

          if (movement.reversesMovementId === undefined) {
            throw new Error("Stored production movement is not recognized.");
          }

          return {
            ...movement,
            reversesMovementId: movement.reversesMovementId,
          };
        }),
      };
    });
  }

  override async appendCompensation(
    input: AppendProductionCompensation,
  ): Promise<void> {
    await this.inTenant(input.tenantId, async (tx) => {
      const existing = await this.findCompensationIn(
        tx,
        input.tenantId,
        input.originalRunId,
      );

      if (existing) {
        throw new Error(
          `Production compensation is already stored for ${input.originalRunId}.`,
        );
      }

      let position = await this.nextPosition(tx);

      for (const movement of input.movements) {
        await this.postMovement(tx, movement, position);
        position += 1;
      }
    });
  }

  override async saveCostPolicy(
    input: SaveProductionCostPolicy,
  ): Promise<void> {
    await this.inTenant(input.tenantId, async (tx) => {
      await tx
        .insert(productionCostPolicies)
        .values({
          tenantId: input.tenantId,
          costRule: input.costRule,
        })
        .onConflictDoUpdate({
          target: productionCostPolicies.tenantId,
          set: { costRule: input.costRule },
        });
      await tx
        .delete(preparationStandardCosts)
        .where(eq(preparationStandardCosts.tenantId, input.tenantId));

      if (input.preparations.length === 0) {
        return;
      }

      await tx.insert(preparationStandardCosts).values(
        input.preparations.map((preparation) => ({
          tenantId: input.tenantId,
          recipeId: preparation.recipeId,
          standardUnitCost: preparation.standardUnitCost,
        })),
      );
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

  private async readRun(
    tx: Transaction,
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null> {
    const rows = await tx
      .select()
      .from(productionRuns)
      .where(
        and(
          eq(productionRuns.tenantId, tenantId),
          eq(productionRuns.id, runId),
        ),
      )
      .limit(1);
    const run = rows[0];

    if (run === undefined) {
      return null;
    }

    const movements = rowsOf<MovementRow>(
      await tx.execute(sql`
        SELECT
          id,
          venue_id,
          location_id,
          ingredient_id,
          quantity,
          unit_cost,
          movement_type,
          reference,
          occurred_at,
          actor_id,
          recipe_version,
          reverses_movement_id
        FROM stock_movements
        WHERE tenant_id = ${tenantId}
          AND reference = ${runId}
          AND reverses_movement_id IS NULL
        ORDER BY position
      `),
    );

    return runFrom(
      run,
      movements.map((row) => movementFrom(tenantId, row)),
    );
  }

  private async findCompensationIn(
    tx: Transaction,
    tenantId: string,
    originalRunId: string,
  ): Promise<boolean> {
    const [row] = rowsOf<CountRow>(
      await tx.execute(sql`
        SELECT count(*) AS count
        FROM stock_movements
        WHERE tenant_id = ${tenantId}
          AND reverses_movement_id IS NOT NULL
          AND reverses_movement_id IN (
            SELECT id
            FROM stock_movements
            WHERE tenant_id = ${tenantId}
              AND reference = ${originalRunId}
              AND reverses_movement_id IS NULL
          )
      `),
    );

    return asNumber(row?.count ?? 0) > 0;
  }

  private async postMovement(
    tx: Transaction,
    movement: StoredMovement,
    position: number,
  ): Promise<void> {
    const holding = await this.holding(
      tx,
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    const averageCost =
      movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT && movement.quantity > 0
        ? nextAverageCost({
            onHand: holding.quantity,
            averageCost: holding.averageCost,
            receivedQuantity: movement.quantity,
            receiptCost: movement.unitCost,
          })
        : holding.averageCost;

    await tx.execute(sql`
      INSERT INTO stock_movements (
        tenant_id,
        id,
        position,
        venue_id,
        location_id,
        ingredient_id,
        quantity,
        unit_cost,
        movement_type,
        reference,
        occurred_at,
        order_line_id,
        role,
        recipe_version,
        reason,
        actor_id,
        reverses_movement_id
      )
      VALUES (
        ${movement.tenantId},
        ${movement.id},
        ${position},
        ${movement.venueId},
        ${movement.locationId},
        ${movement.ingredientId},
        ${movement.quantity},
        ${movement.unitCost},
        ${movement.type},
        ${movement.reference},
        ${movement.occurredAt},
        NULL,
        NULL,
        ${movement.recipeVersion},
        NULL,
        ${movement.actorId},
        ${reversesOf(movement)}
      )
    `);
    await tx.execute(sql`
      INSERT INTO stock_balances (
        tenant_id,
        location_id,
        ingredient_id,
        quantity,
        average_cost
      )
      VALUES (
        ${movement.tenantId},
        ${movement.locationId},
        ${movement.ingredientId},
        ${movement.quantity},
        ${averageCost}
      )
      ON CONFLICT (tenant_id, location_id, ingredient_id) DO UPDATE SET
        quantity = stock_balances.quantity + excluded.quantity,
        average_cost = excluded.average_cost
    `);
  }

  private async holding(
    tx: Transaction,
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ quantity: number; averageCost: number }> {
    const [row] = rowsOf<BalanceRow>(
      await tx.execute(sql`
        SELECT quantity, average_cost
        FROM stock_balances
        WHERE tenant_id = ${tenantId}
          AND location_id = ${locationId}
          AND ingredient_id = ${ingredientId}
      `),
    );

    return {
      quantity: row ? asNumber(row.quantity) : 0,
      averageCost: row ? asNumber(row.average_cost) : 0,
    };
  }

  private async nextPosition(tx: Transaction): Promise<number> {
    const [row] = rowsOf<CountRow>(
      await tx.execute(sql`
        SELECT coalesce(max(position), 0) AS position
        FROM stock_movements
      `),
    );

    return asNumber(row?.position ?? 0) + 1;
  }
}

const runFrom = (
  run: RunRow,
  movements: readonly StoredMovement[],
): RecordedProductionRun => ({
  runId: run.id,
  tenantId: run.tenantId,
  venueId: run.venueId,
  locationId: run.locationId,
  recipeId: run.recipeId,
  recipeVersion: run.recipeVersion,
  expectedQuantity: run.expectedQuantity,
  actualQuantity: run.actualQuantity,
  variance: run.variance,
  outputUnitCost: run.outputUnitCost,
  movements,
});
