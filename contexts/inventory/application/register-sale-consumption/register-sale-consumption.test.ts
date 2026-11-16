import { StaleGeneration } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { InMemoryShortageRepository } from "#adapters/memory/in-memory-shortage-repository.js";
import { EvaluateStockLevels } from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import type { ExplodeRecipeInput } from "#application/explode-recipe/explode-recipe.js";
import { ExplodeRecipe } from "#application/explode-recipe/explode-recipe.js";
import { OperationGeneration } from "#application/ports/operation-generation.js";
import { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import { RecipeVersionReader } from "#application/ports/recipe-version.js";
import { ReferenceCostList } from "#application/ports/reference-cost.js";
import { ShortageAudit } from "#application/ports/shortage-audit.js";
import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import { StockAlertPublisher } from "#application/ports/stock-alert-publisher.js";
import {
  type AppendStock,
  CONSUMPTION_ROLE,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import type { StockMovementEnvelope } from "#application/ports/stock-movement-queue.js";
import { StockMovementQueue } from "#application/ports/stock-movement-queue.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import { RegisterSaleConsumption } from "#application/register-sale-consumption/register-sale-consumption.js";
import {
  type ExplodedQuantity,
  QUANTITY_SCALE,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY, SHORTAGE_KIND } from "#domain/shortage-alert.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const CHEESE_ID = "ingredient_cheese";
const SAUCE_ID = "recipe_tomato_sauce";
const TOMATO_ID = "ingredient_tomato";
const OIL_ID = "ingredient_oil";
const VINEGAR_ID = "ingredient_vinegar";
const GIN_ID = "ingredient_gin";
const BURGER_ID = "product_burger";
const COCKTAIL_ID = "product_cocktail";
const PASTA_ID = "product_pasta";
const SALAD_ID = "product_salad";
const MISSING_ID = "product_without_recipe";
const VARIANT_ID = "variant_classic";
const MODIFIER_ID = "modifier_extra_cheese";
const LINE_ID = "order_line_burger";
const GENERATION = 1;
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";
const BEEF_COST = 180_000;
const CHEESE_COST = 90_000;

const grams = (value: number): number => value * QUANTITY_SCALE;

class ScriptedExplosion extends ExplodeRecipe {
  readonly calls: ExplodeRecipeInput[] = [];

  constructor(
    private readonly byProduct: ReadonlyMap<
      string,
      ReadonlyMap<number, readonly ExplodedQuantity[]>
    >,
  ) {
    super({} as RecipeCatalogRepository);
  }

  override async execute(
    input: ExplodeRecipeInput,
  ): Promise<readonly ExplodedQuantity[]> {
    this.calls.push(input);
    const lines = this.byProduct.get(input.productId)?.get(input.version ?? -1);

    if (!lines) {
      throw new UnknownRecipe();
    }

    return lines;
  }
}

class MemoryLedger extends StockLedgerRepository {
  readonly lines: LedgerLine[] = [];
  readonly alerts: NegativeStockOpenedEvent[] = [];
  private readonly balances = new Map<string, number>();

  seedBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
  ): void {
    this.balances.set(`${tenantId}:${locationId}:${ingredientId}`, quantity);
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

  override async hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean> {
    return this.alerts.some(
      (alert) =>
        alert.tenantId === tenantId &&
        alert.locationId === locationId &&
        alert.ingredientId === ingredientId,
    );
  }

  override async append(input: AppendStock): Promise<void> {
    for (const movement of input.movements) {
      const key = `${movement.tenantId}:${movement.locationId}:${movement.ingredientId}`;
      this.balances.set(key, (this.balances.get(key) ?? 0) + movement.quantity);
      this.lines.push(movement);
    }

    this.alerts.push(...input.alerts);
  }

  override async inTransaction<T>(work: (tx: this) => Promise<T>): Promise<T> {
    const lines = this.lines.map((line) => ({ ...line }));
    const alerts = this.alerts.map((alert) => ({ ...alert }));
    const balances = new Map(this.balances);

    try {
      return await super.inTransaction(work);
    } catch (error) {
      this.lines.splice(0, this.lines.length, ...lines);
      this.alerts.splice(0, this.alerts.length, ...alerts);
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

class SilentShortageAudit extends ShortageAudit {
  override async record(): Promise<void> {}
}

class ThrowingShortage extends InMemoryShortageRepository {
  override async saveLevelAlert(): Promise<void> {
    throw new Error("alert insert failed");
  }
}

class MemoryAlerts extends StockAlertPublisher {
  readonly notices: NegativeStockOpenedEvent[] = [];

  override async publish(event: NegativeStockOpenedEvent): Promise<void> {
    this.notices.push(event);
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

class FixedPointOfSale extends PointOfSaleDirectory {
  override async locationOf(): Promise<string> {
    return LOCATION_ID;
  }
}

class FixedBrand extends VenueDirectory {
  override async brandOf(): Promise<string | null> {
    return BRAND_ID;
  }
}

class MapVersions extends RecipeVersionReader {
  constructor(private readonly versions: ReadonlyMap<string, number>) {
    super();
  }

  override async current(input: { productId: string }): Promise<number | null> {
    return this.versions.get(input.productId) ?? null;
  }
}

class MapCosts extends ReferenceCostList {
  constructor(private readonly costs: ReadonlyMap<string, number>) {
    super();
  }

  override async costOf(
    _tenantId: string,
    ingredientId: string,
  ): Promise<number> {
    const cost = this.costs.get(ingredientId);

    if (cost === undefined) {
      throw new Error(`No reference cost for ${ingredientId}.`);
    }

    return cost;
  }
}

const versioned = (
  entries: ReadonlyArray<[number, readonly ExplodedQuantity[]]>,
): ReadonlyMap<number, readonly ExplodedQuantity[]> => new Map(entries);

const catalog = (): ReadonlyMap<
  string,
  ReadonlyMap<number, readonly ExplodedQuantity[]>
> =>
  new Map([
    [
      BURGER_ID,
      versioned([
        [
          4,
          [
            { ingredientId: BEEF_ID, quantity: grams(150) },
            { ingredientId: CHEESE_ID, quantity: grams(30) },
          ],
        ],
        [
          5,
          [
            { ingredientId: BEEF_ID, quantity: grams(160) },
            { ingredientId: CHEESE_ID, quantity: grams(40) },
          ],
        ],
      ]),
    ],
    [
      COCKTAIL_ID,
      versioned([[4, [{ ingredientId: GIN_ID, quantity: grams(50) }]]]),
    ],
    [
      PASTA_ID,
      versioned([[4, [{ ingredientId: SAUCE_ID, quantity: grams(80) }]]]),
    ],
    [
      SALAD_ID,
      versioned([
        [
          4,
          [
            { ingredientId: OIL_ID, quantity: grams(20) },
            { ingredientId: VINEGAR_ID, quantity: grams(10) },
          ],
        ],
      ]),
    ],
  ]);

const costs = new Map<string, number>([
  [BEEF_ID, BEEF_COST],
  [CHEESE_ID, CHEESE_COST],
  [SAUCE_ID, 4_000],
  [OIL_ID, 500],
  [VINEGAR_ID, 300],
  [GIN_ID, 1_000],
]);

const command = (
  overrides: Partial<{
    orderLineId: string;
    productId: string;
    variantIds: readonly string[];
    modifierIds: readonly string[];
    portions: number;
    generation: number;
  }> = {},
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  generation: GENERATION,
  orderLineId: LINE_ID,
  productId: BURGER_ID,
  variantIds: [VARIANT_ID] as readonly string[],
  modifierIds: [MODIFIER_ID] as readonly string[],
  portions: 2,
  occurredAt: OCCURRED_AT,
  ...overrides,
});

const build = (
  versions: ReadonlyMap<string, number>,
  products = catalog(),
  levels: EvaluateStockLevels | null = null,
) => {
  const explosion = new ScriptedExplosion(products);
  const ledger = new MemoryLedger();
  const queue = new MemoryQueue();
  const alerts = new MemoryAlerts();
  const register = new RegisterSaleConsumption(
    explosion,
    new MapVersions(versions),
    new MapCosts(costs),
    new FixedBrand(),
    new FixedPointOfSale(),
    new FixedGeneration(GENERATION),
    ledger,
    alerts,
    queue,
    levels,
  );

  return { explosion, ledger, queue, alerts, register };
};

const currentVersions = new Map<string, number>([
  [BURGER_ID, 4],
  [COCKTAIL_ID, 4],
  [PASTA_ID, 4],
  [SALAD_ID, 4],
  [MISSING_ID, 4],
]);

it("given burger version 4, when 2 portions are sent, then beef and cheese are consumed at that version and the reference cost is snapshotted", async () => {
  const { explosion, ledger, queue, alerts, register } = build(currentVersions);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, grams(10_000));
  ledger.seedBalance(TENANT_ID, LOCATION_ID, CHEESE_ID, grams(10_000));

  const result = await register.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(explosion.calls[0]).toMatchObject({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    productId: BURGER_ID,
    version: 4,
    variantId: VARIANT_ID,
    modifierIds: [MODIFIER_ID],
  });
  expect(ledger.lines).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ingredientId: BEEF_ID,
        quantity: grams(-300),
        unitCost: BEEF_COST,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
        recipeVersion: 4,
        locationId: LOCATION_ID,
        role: CONSUMPTION_ROLE.CONSUMPTION,
        orderLineId: LINE_ID,
      }),
      expect.objectContaining({
        ingredientId: CHEESE_ID,
        quantity: grams(-60),
        unitCost: CHEESE_COST,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
        recipeVersion: 4,
        locationId: LOCATION_ID,
      }),
    ]),
  );
  expect(queue.envelopes).toHaveLength(2);
  for (const envelope of queue.envelopes) {
    expect(envelope.lane).toBe("after_sales");
    expect(envelope.key).toBe(envelope.event.movementId);
    expect(envelope.event.type).toBe("StockMoved");
    expect(envelope.event.recipeVersion).toBe(4);
  }
  expect(alerts.notices).toHaveLength(0);
});

it("given a cocktail routed to the bar, when it is sent, then it deducts from the same point of sale as the grill", async () => {
  const { ledger, register } = build(currentVersions);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, grams(10_000));
  ledger.seedBalance(TENANT_ID, LOCATION_ID, GIN_ID, grams(10_000));

  await register.execute(
    command({ orderLineId: "order_line_grill", portions: 1 }),
  );
  await register.execute(
    command({
      orderLineId: "order_line_bar",
      productId: COCKTAIL_ID,
      portions: 1,
      variantIds: [],
      modifierIds: [],
    }),
  );

  expect(new Set(ledger.lines.map((line) => line.locationId))).toEqual(
    new Set([LOCATION_ID]),
  );
  expect(ledger.lines.some((line) => line.ingredientId === GIN_ID)).toBe(true);
});

it("given a product with no recipe, when it is sent, then nothing is written and the result is missing recipe", async () => {
  const { ledger, queue, alerts, register } = build(currentVersions);

  const result = await register.execute(
    command({
      orderLineId: "order_line_missing",
      productId: MISSING_ID,
      portions: 1,
    }),
  );

  expect(result).toEqual({ missingRecipe: true });
  expect(ledger.lines).toHaveLength(0);
  expect(queue.envelopes).toHaveLength(0);
  expect(alerts.notices).toHaveLength(0);
});

it("given pasta uses a stocked tomato sauce, when it is sent, then the sauce stays collapsed and tomatoes are untouched", async () => {
  const { ledger, register } = build(currentVersions);

  await register.execute(
    command({
      orderLineId: "order_line_pasta",
      productId: PASTA_ID,
      portions: 1,
      variantIds: [],
      modifierIds: [],
    }),
  );

  expect(ledger.lines.map((line) => line.ingredientId)).toEqual([SAUCE_ID]);
  expect(ledger.lines.some((line) => line.ingredientId === TOMATO_ID)).toBe(
    false,
  );
});

it("given salad uses a non-stocked dressing, when it is sent, then the dressing ingredients are consumed", async () => {
  const { ledger, register } = build(currentVersions);

  await register.execute(
    command({
      orderLineId: "order_line_salad",
      productId: SALAD_ID,
      portions: 1,
      variantIds: [],
      modifierIds: [],
    }),
  );

  expect(ledger.lines.map((line) => line.ingredientId).toSorted()).toEqual([
    OIL_ID,
    VINEGAR_ID,
  ]);
});

it("given version 5 is current, when a new line is sent, then consumption uses version 5", async () => {
  const { explosion, ledger, register } = build(new Map([[BURGER_ID, 5]]));

  await register.execute(
    command({ orderLineId: "order_line_later", portions: 1 }),
  );

  expect(explosion.calls[0]?.version).toBe(5);
  expect(ledger.lines.every((line) => line.recipeVersion === 5)).toBe(true);
  expect(
    ledger.lines.find((line) => line.ingredientId === BEEF_ID)?.quantity,
  ).toBe(grams(-160));
});

it("given 100 g of beef on hand, when a line needing 300 g is sent, then the send succeeds, the balance is -200 g, and one alert opens", async () => {
  const { ledger, queue, alerts, register } = build(currentVersions);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, grams(100));

  const result = await register.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(
    grams(-200),
  );
  expect(ledger.lines.some((line) => line.ingredientId === BEEF_ID)).toBe(true);
  expect(queue.envelopes.length).toBeGreaterThan(0);
  expect(
    alerts.notices.filter((notice) => notice.ingredientId === BEEF_ID),
  ).toEqual([
    expect.objectContaining({
      type: "NegativeStockOpened",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: BEEF_ID,
      balance: grams(-200),
    }),
  ]);
});

it("given an open negative alert for beef, when another beef line is sent, then no second beef alert opens", async () => {
  const { ledger, alerts, register } = build(currentVersions);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, grams(100));
  await register.execute(command({ orderLineId: "order_line_first" }));

  await register.execute(command({ orderLineId: "order_line_second" }));

  expect(
    alerts.notices.filter((notice) => notice.ingredientId === BEEF_ID),
  ).toHaveLength(1);
  expect(
    ledger.lines.filter((line) => line.ingredientId === BEEF_ID),
  ).toHaveLength(2);
});

it("given a line already consumed, when the send is redelivered, then nothing new is recorded", async () => {
  const { ledger, queue, alerts, register } = build(currentVersions);
  await register.execute(command());
  const movements = ledger.lines.length;
  const queued = queue.envelopes.length;
  const opened = alerts.notices.length;

  const result = await register.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(ledger.lines).toHaveLength(movements);
  expect(queue.envelopes).toHaveLength(queued);
  expect(alerts.notices).toHaveLength(opened);
});

it("given the current generation, when a send arrives with another generation, then StaleGeneration is thrown and nothing is written", async () => {
  const { explosion, ledger, queue, register } = build(currentVersions);

  await expect(
    register.execute(command({ generation: GENERATION + 1 })),
  ).rejects.toBeInstanceOf(StaleGeneration);
  expect(ledger.lines).toHaveLength(0);
  expect(queue.envelopes).toHaveLength(0);
  expect(explosion.calls).toHaveLength(0);
});

const beefLevels = {
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  maximum: grams(20),
  reorderPoint: grams(15),
  minimum: grams(8),
};

it("given beef at zero and alerts on, when the sale is registered, then one critical alert opens in that ledger transaction and the negative stock notice stays", async () => {
  const shortages = new InMemoryShortageRepository();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, alerts, register } = build(
    currentVersions,
    catalog(),
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
  );
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, 0);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, CHEESE_ID, grams(1000));

  await register.execute(command());

  const open = await shortages.listOpenShortages(TENANT_ID, VENUE_ID);
  expect(open).toHaveLength(1);
  expect(open[0]).toMatchObject({
    kind: SHORTAGE_KIND.LEVEL,
    alert: {
      ingredientId: BEEF_ID,
      severity: LEVEL_SEVERITY.CRITICAL,
      soldOut: true,
      status: "open",
    },
  });
  expect(alerts.notices).toEqual([
    expect.objectContaining({
      type: "NegativeStockOpened",
      ingredientId: BEEF_ID,
    }),
  ]);
  expect(ledger.lines).toHaveLength(2);
});

it("given alerts on, when saving the level alert fails, then the sale movement rolls back with the alert", async () => {
  const shortages = new ThrowingShortage();
  await shortages.saveBrandLevel(beefLevels);
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { ledger, alerts, register } = build(
    currentVersions,
    catalog(),
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
  );
  ledger.seedBalance(TENANT_ID, LOCATION_ID, BEEF_ID, 0);
  ledger.seedBalance(TENANT_ID, LOCATION_ID, CHEESE_ID, grams(1000));

  await expect(register.execute(command())).rejects.toThrow(
    "alert insert failed",
  );

  expect(ledger.lines).toHaveLength(0);
  expect(ledger.alerts).toHaveLength(0);
  expect(alerts.notices).toHaveLength(0);
  expect(await shortages.listOpenShortages(TENANT_ID, VENUE_ID)).toEqual([]);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(0);
});
