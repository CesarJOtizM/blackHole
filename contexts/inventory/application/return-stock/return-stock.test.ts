import { StaleGeneration } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import { InMemoryShortageRepository } from "#adapters/memory/in-memory-shortage-repository.js";
import { EvaluateStockLevels } from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import { OperationGeneration } from "#application/ports/operation-generation.js";
import { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  type AppendStock,
  CONSUMPTION_ROLE,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import type { StockMovementEnvelope } from "#application/ports/stock-movement-queue.js";
import { StockMovementQueue } from "#application/ports/stock-movement-queue.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import {
  LineReversalConflict,
  ReturnStock,
} from "#application/return-stock/return-stock.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY, SHORTAGE_KIND } from "#domain/shortage-alert.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const CHEESE_ID = "ingredient_cheese";
const LINE_ID = "order_line_burger";
const GENERATION = 1;
const SENT_AT = "2026-11-13T18:00:00.000Z";
const RETURNED_AT = "2026-11-13T18:05:00.000Z";
const BEEF_COST = 180_000;
const CHEESE_COST = 90_000;
const OTHER_COST = 1;

const grams = (value: number): number => value * QUANTITY_SCALE;

class MemoryLedger extends StockLedgerRepository {
  readonly lines: LedgerLine[] = [];
  private readonly balances = new Map<string, number>();

  seed(line: LedgerLine): void {
    this.lines.push(line);
    const key = `${line.tenantId}:${line.locationId}:${line.ingredientId}`;
    this.balances.set(key, (this.balances.get(key) ?? 0) + line.quantity);
  }

  override async findLine(
    tenantId: string,
    orderLineId: string,
    role: LedgerLine["role"],
  ): Promise<readonly LedgerLine[]> {
    return this.lines.filter(
      (line) =>
        line.tenantId === tenantId &&
        line.orderLineId === orderLineId &&
        line.role === role,
    );
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.balances.get(`${tenantId}:${locationId}:${ingredientId}`) ?? 0;
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async append(input: AppendStock): Promise<void> {
    for (const movement of input.movements) {
      const key = `${movement.tenantId}:${movement.locationId}:${movement.ingredientId}`;
      this.balances.set(key, (this.balances.get(key) ?? 0) + movement.quantity);
      this.lines.push(movement);
    }
  }

  override async inTransaction<T>(work: (tx: this) => Promise<T>): Promise<T> {
    const lines = this.lines.map((line) => ({ ...line }));
    const balances = new Map(this.balances);

    try {
      return await super.inTransaction(work);
    } catch (error) {
      this.lines.splice(0, this.lines.length, ...lines);
      this.balances.clear();

      for (const [key, quantity] of balances) {
        this.balances.set(key, quantity);
      }

      throw error;
    }
  }
}

class MemoryQueue extends StockMovementQueue {
  readonly envelopes: StockMovementEnvelope[] = [];

  override async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    this.envelopes.push(envelope);
  }
}

class FixedGeneration extends OperationGeneration {
  constructor(private readonly current: number) {
    super();
  }

  override async assertCurrent(
    _tenantId: string,
    _venueId: string,
    generation: number,
  ): Promise<void> {
    if (generation !== this.current) {
      throw new StaleGeneration();
    }
  }
}

const consumption = (
  ingredientId: string,
  quantity: number,
  unitCost: number,
): LedgerLine => ({
  id: `movement_${LINE_ID}_consumption_${ingredientId}`,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId,
  quantity,
  unitCost,
  type: MOVEMENT_TYPE.SALE_CONSUMPTION,
  reference: LINE_ID,
  occurredAt: SENT_AT,
  orderLineId: LINE_ID,
  role: CONSUMPTION_ROLE.CONSUMPTION,
  recipeVersion: 4,
  reason: null,
  actorId: null,
});

const command = (generation = GENERATION) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  generation,
  orderLineId: LINE_ID,
  productId: "product_burger",
  variantIds: [] as readonly string[],
  modifierIds: [] as readonly string[],
  portions: 2,
  occurredAt: RETURNED_AT,
});

const BRAND_ID = "organization_brand_1";

class FixedBrand extends VenueDirectory {
  override async brandOf(): Promise<string> {
    return BRAND_ID;
  }
}

class SilentShortageAudit extends ShortageAudit {
  override async record(): Promise<void> {}
}

class ThrowingShortage extends InMemoryShortageRepository {
  override async saveLevelAlert(): Promise<void> {
    throw new Error("alert insert failed");
  }
}

const build = (
  levels: EvaluateStockLevels | null = null,
  venues: VenueDirectory | null = null,
) => {
  const ledger = new MemoryLedger();
  const queue = new MemoryQueue();
  const restore = new ReturnStock(
    new FixedGeneration(GENERATION),
    ledger,
    queue,
    levels,
    venues,
  );

  return { ledger, queue, restore };
};

it("given a line consumed at version 4, when it is returned after that version was current, then the stored quantities and unit cost are restored", async () => {
  const { ledger, queue, restore } = build();
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));
  ledger.seed(consumption(CHEESE_ID, grams(-60), CHEESE_COST));

  const result = await restore.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  const returns = ledger.lines.filter(
    (line) => line.type === MOVEMENT_TYPE.SALE_RETURN,
  );
  expect(returns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ingredientId: BEEF_ID,
        quantity: grams(300),
        unitCost: BEEF_COST,
        recipeVersion: 4,
        role: CONSUMPTION_ROLE.REVERSAL,
        occurredAt: RETURNED_AT,
        reversesMovementId: `movement_${LINE_ID}_consumption_${BEEF_ID}`,
      }),
      expect.objectContaining({
        ingredientId: CHEESE_ID,
        quantity: grams(60),
        unitCost: CHEESE_COST,
        recipeVersion: 4,
      }),
    ]),
  );
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(0);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, CHEESE_ID)).toBe(0);
  expect(queue.envelopes).toHaveLength(2);
  for (const envelope of queue.envelopes) {
    expect(envelope.lane).toBe("after_sales");
    expect(envelope.key).toBe(envelope.event.movementId);
    expect(envelope.event.recipeVersion).toBe(4);
    expect(envelope.event.unitCost).toBe(
      envelope.event.ingredientId === BEEF_ID ? BEEF_COST : CHEESE_COST,
    );
  }
});

it("given a void already returned, when it is redelivered, then no extra return is recorded", async () => {
  const { ledger, queue, restore } = build();
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));
  await restore.execute(command());
  const movements = ledger.lines.length;
  const queued = queue.envelopes.length;

  const result = await restore.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(ledger.lines).toHaveLength(movements);
  expect(queue.envelopes).toHaveLength(queued);
});

it("given the line was already reversed as waste, when a return is requested, then LineReversalConflict carries the stored unit cost and nothing is written", async () => {
  const { ledger, queue, restore } = build();
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));
  ledger.seed({
    id: `movement_${LINE_ID}_reversal_${BEEF_ID}`,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: BEEF_ID,
    quantity: grams(-300),
    unitCost: OTHER_COST,
    type: MOVEMENT_TYPE.WASTE,
    reference: LINE_ID,
    occurredAt: RETURNED_AT,
    orderLineId: LINE_ID,
    role: CONSUMPTION_ROLE.REVERSAL,
    recipeVersion: 4,
    reason: "customer left",
    actorId: "user_cook",
  });
  const movements = ledger.lines.length;

  const pending = restore.execute(command());

  await expect(pending).rejects.toBeInstanceOf(LineReversalConflict);
  await expect(pending).rejects.toMatchObject({ unitCost: BEEF_COST });
  expect(ledger.lines).toHaveLength(movements);
  expect(
    ledger.lines.some((line) => line.type === MOVEMENT_TYPE.SALE_RETURN),
  ).toBe(false);
  expect(queue.envelopes).toHaveLength(0);
});

it("given the current generation, when a return arrives with another generation, then StaleGeneration is thrown and nothing is written", async () => {
  const { ledger, restore } = build();
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));

  await expect(restore.execute(command(GENERATION + 1))).rejects.toBeInstanceOf(
    StaleGeneration,
  );
  expect(ledger.lines).toHaveLength(1);
});

const beefLevels = {
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  maximum: grams(20),
  reorderPoint: grams(15),
  minimum: grams(8),
};

it("given a consumed line and alerts on, when stock is returned to zero, then one critical alert opens in that ledger transaction", async () => {
  const shortages = new InMemoryShortageRepository();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, restore } = build(
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
    new FixedBrand(),
  );
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));
  ledger.seed(consumption(CHEESE_ID, grams(-60), CHEESE_COST));

  await restore.execute(command());

  const open = await shortages.listOpenShortages(TENANT_ID, VENUE_ID);
  expect(open).toHaveLength(1);
  expect(open[0]).toMatchObject({
    kind: SHORTAGE_KIND.LEVEL,
    alert: {
      ingredientId: BEEF_ID,
      severity: LEVEL_SEVERITY.CRITICAL,
      soldOut: true,
    },
  });
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(0);
});

it("given alerts on, when saving the level alert fails, then the return movement rolls back", async () => {
  const shortages = new ThrowingShortage();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, queue, restore } = build(
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
    new FixedBrand(),
  );
  ledger.seed(consumption(BEEF_ID, grams(-300), BEEF_COST));

  await expect(restore.execute(command())).rejects.toThrow(
    "alert insert failed",
  );

  expect(ledger.lines).toHaveLength(1);
  expect(
    ledger.lines.some((line) => line.type === MOVEMENT_TYPE.SALE_RETURN),
  ).toBe(false);
  expect(queue.envelopes).toHaveLength(0);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(
    grams(-300),
  );
  expect(await shortages.listOpenShortages(TENANT_ID, VENUE_ID)).toEqual([]);
});
