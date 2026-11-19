import {
  RecordAuditEvent,
  StaleGeneration,
} from "@blackhole/platform/application/entry-port";
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
import { RecordWaste } from "#application/record-waste/record-waste.js";
import { LineReversalConflict } from "#application/return-stock/return-stock.js";
import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
} from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY, SHORTAGE_KIND } from "#domain/shortage-alert.js";
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const LINE_ID = "order_line_burger";
const ACTOR_ID = "user_cook";
const REASON = "customer left";
const GENERATION = 1;
const SENT_AT = "2026-11-13T18:00:00.000Z";
const WASTED_AT = "2026-11-13T18:20:00.000Z";
const BEEF_COST = 180_000;
const OTHER_COST = 1;
const BRAND_ID = "organization_brand_1";
const PRODUCT_ID = "product_burger";
const VERSION_4_GRAMS = 150;
const VERSION_5_GRAMS = 80;
const PORTIONS = 2;

const grams = (value: number): number => value * QUANTITY_SCALE;

class MemoryLedger extends StockLedgerRepository {
  readonly lines: LedgerLine[] = [];

  seed(line: LedgerLine): void {
    this.lines.push(line);
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
    const ledger = StockLedger.open({ tenantId, locationId });

    for (const line of this.lines) {
      if (line.tenantId !== tenantId || line.locationId !== locationId) {
        continue;
      }

      ledger.append({
        id: line.id,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        type: line.type,
        reference: line.reference,
        occurredAt: line.occurredAt,
        ...(line.reversesMovementId === undefined
          ? {}
          : { reversesMovementId: line.reversesMovementId }),
      });
    }

    return ledger.balance(ingredientId);
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async append(input: AppendStock): Promise<void> {
    for (const movement of input.movements) {
      this.lines.push(movement);
    }
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerLine[]> {
    return this.lines.filter(
      (line) => line.tenantId === tenantId && line.venueId === venueId,
    );
  }

  override async inTransaction<T>(work: (tx: this) => Promise<T>): Promise<T> {
    const lines = this.lines.map((line) => ({ ...line }));

    try {
      return await super.inTransaction(work);
    } catch (error) {
      this.lines.splice(0, this.lines.length, ...lines);
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

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

const consumption = (): LedgerLine => ({
  id: `movement_${LINE_ID}_consumption_${BEEF_ID}`,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: BEEF_ID,
  quantity: grams(-300),
  unitCost: BEEF_COST,
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
  productId: PRODUCT_ID,
  variantIds: [] as readonly string[],
  modifierIds: [] as readonly string[],
  portions: PORTIONS,
  occurredAt: WASTED_AT,
  actorId: ACTOR_ID,
  reason: REASON,
});

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
  const audit = new CapturedAudit();
  const record = new RecordWaste(
    new FixedGeneration(GENERATION),
    ledger,
    queue,
    audit,
    levels,
    venues,
  );

  return { ledger, queue, audit, record };
};

const publishVersionFive = (): RecipeCatalog => {
  const catalog = RecipeCatalog.open({
    id: `recipe_catalog_${BRAND_ID}`,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });
  catalog.upsertIngredient({
    id: BEEF_ID,
    name: "beef",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: BEEF_COST,
  });
  const burger = {
    id: "recipe_burger",
    name: "burger",
    productId: PRODUCT_ID,
    lines: [
      {
        kind: "ingredient" as const,
        ingredientId: BEEF_ID,
        netQuantity: VERSION_4_GRAMS,
        yieldPercent: 100,
      },
    ],
  };
  catalog.upsertRecipe(burger);
  catalog.publish({ authorId: ACTOR_ID });
  catalog.publish({ authorId: ACTOR_ID });
  catalog.publish({ authorId: ACTOR_ID });
  catalog.publish({ authorId: ACTOR_ID });
  catalog.upsertRecipe({
    ...burger,
    lines: [
      {
        kind: "ingredient",
        ingredientId: BEEF_ID,
        netQuantity: VERSION_5_GRAMS,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: ACTOR_ID });

  return catalog;
};

it("given a line consumed at version 4, when version 5 is published and the line is wasted after start, then waste stores the version 4 quantities, reason and actor, and on-hand stays at the consumption", async () => {
  const { ledger, queue, audit, record } = build();
  const stored = consumption();
  ledger.seed(stored);
  const catalog = publishVersionFive();
  const versionFour = catalog.explode({
    productId: PRODUCT_ID,
    version: 4,
  });
  const versionFive = catalog.explode({
    productId: PRODUCT_ID,
    version: 5,
  });

  expect(catalog.currentVersion).toBe(5);
  expect(versionFour).toEqual([
    { ingredientId: BEEF_ID, quantity: grams(VERSION_4_GRAMS) },
  ]);
  expect(versionFive).toEqual([
    { ingredientId: BEEF_ID, quantity: grams(VERSION_5_GRAMS) },
  ]);

  const result = await record.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  const wasted = ledger.lines.find((line) => line.type === MOVEMENT_TYPE.WASTE);
  expect(wasted).toMatchObject({
    ingredientId: BEEF_ID,
    quantity: grams(-VERSION_4_GRAMS * PORTIONS),
    unitCost: BEEF_COST,
    recipeVersion: 4,
    role: CONSUMPTION_ROLE.REVERSAL,
    reason: REASON,
    actorId: ACTOR_ID,
    occurredAt: WASTED_AT,
  });
  expect(wasted?.quantity).not.toBe(
    -(versionFive[0]?.quantity ?? 0) * PORTIONS,
  );
  expect(ledger.lines[0]).toEqual(stored);
  expect(
    ledger.lines.some((line) => line.type === MOVEMENT_TYPE.SALE_RETURN),
  ).toBe(false);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(
    grams(-VERSION_4_GRAMS * PORTIONS),
  );
  expect(queue.envelopes).toEqual([
    expect.objectContaining({
      lane: "after_sales",
      key: wasted?.id,
      event: expect.objectContaining({
        type: "StockMoved",
        movementType: MOVEMENT_TYPE.WASTE,
        unitCost: BEEF_COST,
        recipeVersion: 4,
        quantity: grams(-VERSION_4_GRAMS * PORTIONS),
      }),
    }),
  ]);
  expect(audit.commands).toEqual([
    expect.objectContaining({
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: VENUE_ID,
      siteId: VENUE_ID,
      action: "inventory.record-waste",
      entity: LINE_ID,
      reason: REASON,
    }),
  ]);
});

it("given waste already recorded, when it is redelivered, then nothing new is recorded and the audit is not repeated", async () => {
  const { ledger, queue, audit, record } = build();
  ledger.seed(consumption());
  await record.execute(command());
  const movements = ledger.lines.length;
  const queued = queue.envelopes.length;

  const result = await record.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(ledger.lines).toHaveLength(movements);
  expect(queue.envelopes).toHaveLength(queued);
  expect(audit.commands).toHaveLength(1);
});

it("given the line was already returned, when waste is requested, then LineReversalConflict carries the stored unit cost and nothing is audited", async () => {
  const { ledger, queue, audit, record } = build();
  ledger.seed(consumption());
  ledger.seed({
    id: `movement_${LINE_ID}_reversal_${BEEF_ID}`,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: BEEF_ID,
    quantity: grams(300),
    unitCost: OTHER_COST,
    type: MOVEMENT_TYPE.SALE_RETURN,
    reference: LINE_ID,
    occurredAt: WASTED_AT,
    orderLineId: LINE_ID,
    role: CONSUMPTION_ROLE.REVERSAL,
    recipeVersion: 4,
    reason: null,
    actorId: null,
    reversesMovementId: `movement_${LINE_ID}_consumption_${BEEF_ID}`,
  });
  const movements = ledger.lines.length;

  const pending = record.execute(command());

  await expect(pending).rejects.toBeInstanceOf(LineReversalConflict);
  await expect(pending).rejects.toMatchObject({ unitCost: BEEF_COST });
  expect(ledger.lines).toHaveLength(movements);
  expect(ledger.lines.some((line) => line.type === MOVEMENT_TYPE.WASTE)).toBe(
    false,
  );
  expect(queue.envelopes).toHaveLength(0);
  expect(audit.commands).toHaveLength(0);
});

it("given the current generation, when waste arrives with another generation, then StaleGeneration is thrown and nothing is audited", async () => {
  const { ledger, audit, record } = build();
  ledger.seed(consumption());

  await expect(record.execute(command(GENERATION + 1))).rejects.toBeInstanceOf(
    StaleGeneration,
  );
  expect(ledger.lines).toHaveLength(1);
  expect(audit.commands).toHaveLength(0);
});

const beefLevels = {
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  maximum: grams(20),
  reorderPoint: grams(15),
  minimum: grams(8),
};

it("given a consumed line and alerts on, when waste is recorded, then one critical alert opens in that ledger transaction", async () => {
  const shortages = new InMemoryShortageRepository();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, record } = build(
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
    new FixedBrand(),
  );
  ledger.seed(consumption());

  await record.execute(command());

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
  expect(ledger.lines.some((line) => line.type === MOVEMENT_TYPE.WASTE)).toBe(
    true,
  );
});

it("given alerts on, when saving the level alert fails, then the waste movement rolls back", async () => {
  const shortages = new ThrowingShortage();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, queue, audit, record } = build(
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
    new FixedBrand(),
  );
  ledger.seed(consumption());

  await expect(record.execute(command())).rejects.toThrow(
    "alert insert failed",
  );

  expect(ledger.lines).toHaveLength(1);
  expect(ledger.lines.some((line) => line.type === MOVEMENT_TYPE.WASTE)).toBe(
    false,
  );
  expect(queue.envelopes).toHaveLength(0);
  expect(audit.commands).toHaveLength(0);
  expect(await shortages.listOpenShortages(TENANT_ID, VENUE_ID)).toEqual([]);
});
