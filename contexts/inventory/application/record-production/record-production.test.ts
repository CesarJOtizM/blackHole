import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  INVENTORY_LOCATION_KIND,
  InventoryLocationDirectory,
} from "#application/ports/inventory-location-directory.js";
import type {
  AppendProduction,
  ProductionCostPolicy,
  RecordedProductionRun,
} from "#application/ports/production-repository.js";
import { ProductionRepository } from "#application/ports/production-repository.js";
import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import { RecipeCatalogRepository as RecipeCatalogStore } from "#application/ports/recipe-catalog-repository.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import {
  MissingProductionCostPolicy,
  PreparationNotStocked,
  RecordProduction,
  UnknownProductionLocation,
} from "#application/record-production/record-production.js";
import { UnknownVenue } from "#application/view-theoretical-cost/view-theoretical-cost.js";
import { PRODUCTION_COST_RULE } from "#domain/production.js";
import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
} from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const LOCATION_ID = "location_point_of_sale";
const WAREHOUSE_ID = "location_warehouse";
const TOMATO_ID = "ingredient_tomato";
const ONION_ID = "ingredient_onion";
const SAUCE_ID = "recipe_tomato_sauce";
const SAUCE_PRODUCT_ID = "product_tomato_sauce";
const PASTA_ID = "recipe_pasta";
const PASTA_PRODUCT_ID = "product_pasta";
const VINAIGRETTE_ID = "recipe_vinaigrette";
const VINAIGRETTE_PRODUCT_ID = "product_vinaigrette";
const SALAD_ID = "recipe_salad";
const SALAD_PRODUCT_ID = "product_salad";
const RUN_ID = "run_sauce";
const ACTOR_ID = "user_kitchen_chief";
const AUTHOR_ID = "user_owner";
const DEVICE_ID = "device_kitchen";
const OCCURRED_AT = "2026-11-13T12:00:00.000Z";
const RECORD_PRODUCTION = "inventory.record-production";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const balanceKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}:${locationId}:${ingredientId}`;

const alertKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}:${locationId}:${ingredientId}`;

const runKey = (tenantId: string, runId: string): string =>
  `${tenantId}:${runId}`;

const policyKey = (tenantId: string, recipeId: string): string =>
  `${tenantId}:${recipeId}`;

const gramIngredient = (id: string, name: string) => ({
  id,
  name,
  baseUnit: BASE_UNIT.GRAM,
  purchaseUnit: { name: "g", baseQuantity: 1 },
  recipeUnit: { name: "g", baseQuantity: 1 },
  referenceCostCop: 0,
});

class MemoryCatalogs extends RecipeCatalogStore {
  constructor(private readonly catalog: RecipeCatalog) {
    super();
  }

  override async load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipeCatalog | null> {
    if (
      tenantId === this.catalog.tenantId &&
      brandId === this.catalog.brandId
    ) {
      return this.catalog;
    }

    return null;
  }

  override async save(): Promise<void> {
    return undefined;
  }

  override async listPublications(): Promise<
    Awaited<ReturnType<RecipeCatalogRepository["listPublications"]>>
  > {
    return [];
  }
}

class MemoryVenues extends VenueDirectory {
  override async brandOf(
    tenantId: string,
    venueId: string,
  ): Promise<string | null> {
    if (tenantId === TENANT_ID && venueId === VENUE_ID) {
      return BRAND_ID;
    }

    return null;
  }
}

class MemoryLocations extends InventoryLocationDirectory {
  override async find(
    _tenantId: string,
    locationId: string,
  ): Promise<{ id: string; kind: "point" | "warehouse" } | null> {
    if (locationId === LOCATION_ID) {
      return { id: LOCATION_ID, kind: INVENTORY_LOCATION_KIND.POINT };
    }

    if (locationId === WAREHOUSE_ID) {
      return { id: WAREHOUSE_ID, kind: INVENTORY_LOCATION_KIND.WAREHOUSE };
    }

    return null;
  }
}

class MemoryProduction extends ProductionRepository {
  readonly appended: AppendProduction[] = [];
  private readonly balances = new Map<string, number>();
  private readonly averages = new Map<string, number>();
  private readonly policies = new Map<string, ProductionCostPolicy>();
  private readonly runs = new Map<string, RecordedProductionRun>();
  private readonly openAlerts = new Set<string>();

  rememberBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
  ): void {
    this.balances.set(balanceKey(tenantId, locationId, ingredientId), quantity);
  }

  rememberAverage(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    averageCost: number,
  ): void {
    this.averages.set(
      balanceKey(tenantId, locationId, ingredientId),
      averageCost,
    );
  }

  rememberPolicy(
    tenantId: string,
    recipeId: string,
    policy: ProductionCostPolicy,
  ): void {
    this.policies.set(policyKey(tenantId, recipeId), policy);
  }

  afterSales(): readonly never[] {
    return [];
  }

  override async findRun(
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null> {
    const found = this.runs.get(runKey(tenantId, runId));
    return found ? copyRun(found) : null;
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.balances.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  override async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.averages.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  override async hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean> {
    return this.openAlerts.has(alertKey(tenantId, locationId, ingredientId));
  }

  override async policyFor(
    tenantId: string,
    recipeId: string,
  ): Promise<ProductionCostPolicy | null> {
    return this.policies.get(policyKey(tenantId, recipeId)) ?? null;
  }

  override async append(input: AppendProduction): Promise<void> {
    const key = runKey(input.run.tenantId, input.run.runId);

    if (this.runs.has(key)) {
      throw new Error("A production run was appended twice.");
    }

    for (const movement of input.run.movements) {
      const stockKey = balanceKey(
        movement.tenantId,
        movement.locationId,
        movement.ingredientId,
      );
      const onHand = this.balances.get(stockKey) ?? 0;

      if (
        movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT &&
        movement.quantity > 0
      ) {
        this.averages.set(
          stockKey,
          nextAverageCost({
            onHand,
            averageCost: this.averages.get(stockKey) ?? 0,
            receivedQuantity: movement.quantity,
            receiptCost: movement.unitCost,
          }),
        );
      }

      this.balances.set(stockKey, onHand + movement.quantity);
    }

    for (const alert of input.alerts) {
      this.openAlerts.add(
        alertKey(alert.tenantId, alert.locationId, alert.ingredientId),
      );
    }

    this.runs.set(key, copyRun(input.run));
    this.appended.push({
      run: copyRun(input.run),
      alerts: input.alerts.map((alert) => ({ ...alert })),
    });
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

const copyRun = (run: RecordedProductionRun): RecordedProductionRun => ({
  ...run,
  movements: run.movements.map((movement) => ({ ...movement })),
});

const openCatalog = (): RecipeCatalog =>
  RecipeCatalog.open({
    id: `recipe_catalog_${BRAND_ID}`,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });

const versionedSauce = (): RecipeCatalog => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(TOMATO_ID, "tomato"));
  catalog.upsertRecipe({
    id: SAUCE_ID,
    name: "tomato sauce",
    productId: SAUCE_PRODUCT_ID,
    outputQuantity: 1000,
    lines: [
      {
        kind: "ingredient",
        ingredientId: TOMATO_ID,
        netQuantity: 1000,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: PASTA_ID,
    name: "pasta",
    productId: PASTA_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_ID,
        netQuantity: 80,
        yieldPercent: 100,
        stocked: true,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: SAUCE_ID,
    name: "tomato sauce",
    productId: SAUCE_PRODUCT_ID,
    outputQuantity: 5000,
    lines: [
      {
        kind: "ingredient",
        ingredientId: TOMATO_ID,
        netQuantity: 6000,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 500,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  return catalog;
};

const costedSauce = (): RecipeCatalog => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(TOMATO_ID, "tomato"));
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: SAUCE_ID,
    name: "tomato sauce",
    productId: SAUCE_PRODUCT_ID,
    outputQuantity: 4000,
    lines: [
      {
        kind: "ingredient",
        ingredientId: TOMATO_ID,
        netQuantity: 3000,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 2000,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: PASTA_ID,
    name: "pasta",
    productId: PASTA_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_ID,
        netQuantity: 80,
        yieldPercent: 100,
        stocked: true,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  return catalog;
};

const vinaigrette = (): RecipeCatalog => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: VINAIGRETTE_ID,
    name: "vinaigrette",
    productId: VINAIGRETTE_PRODUCT_ID,
    outputQuantity: 200,
    lines: [
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 50,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: SALAD_ID,
    name: "salad",
    productId: SALAD_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: VINAIGRETTE_ID,
        netQuantity: 20,
        yieldPercent: 100,
        stocked: false,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  return catalog;
};

const harness = (catalog: RecipeCatalog) => {
  const production = new MemoryProduction();
  const audits = new CapturedAudit();
  const record = new RecordProduction(
    new MemoryCatalogs(catalog),
    new MemoryVenues(),
    new MemoryLocations(),
    production,
    audits,
  );

  return { catalog, production, audits, record };
};

const command = (
  overrides: Partial<Parameters<RecordProduction["execute"]>[0]> = {},
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  recipeId: SAUCE_ID,
  runId: RUN_ID,
  expectedQuantity: 5000,
  actualQuantity: 4600,
  occurredAt: OCCURRED_AT,
  actorId: ACTOR_ID,
  deviceId: DEVICE_ID,
  ...overrides,
});

const consumedAverage = {
  costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  standardUnitCost: null,
} as const;

it("given stocked sauce version 2, when 4600 g of a 5000 g batch is registered, then output uses the recipe id explode returns and movements store that cloud version", async () => {
  const { catalog, production, audits, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);
  const sold = catalog.explode({ productId: PASTA_PRODUCT_ID });

  const run = await record.execute(command());

  expect(catalog.currentVersion).toBe(2);
  expect(sold).toEqual([
    { ingredientId: SAUCE_ID, quantity: 80 * QUANTITY_SCALE },
  ]);
  expect(run.variance).toBe(-400);
  expect(run.recipeVersion).toBe(2);
  expect(run.outputUnitCost).toBe(0);
  expect(production.appended).toHaveLength(1);
  expect(production.afterSales()).toEqual([]);
  expect(run.movements).toEqual([
    {
      id: `${RUN_ID}:consumption:0`,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: ONION_ID,
      quantity: grams(-500),
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
      occurredAt: OCCURRED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: 2,
    },
    {
      id: `${RUN_ID}:consumption:1`,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      quantity: grams(-6000),
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
      occurredAt: OCCURRED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: 2,
    },
    {
      id: `${RUN_ID}:output`,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: sold[0]?.ingredientId,
      quantity: grams(4600),
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      reference: RUN_ID,
      occurredAt: OCCURRED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: 2,
    },
  ]);
  expect(run.movements[2]?.ingredientId).toBe(SAUCE_ID);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: RECORD_PRODUCTION,
      entity: RUN_ID,
      before: null,
      after: {
        runId: RUN_ID,
        recipeId: SAUCE_ID,
        recipeVersion: 2,
        locationId: LOCATION_ID,
        expectedQuantity: 5000,
        actualQuantity: 4600,
        variance: -400,
        outputUnitCost: 0,
      },
      reason: "production",
    },
  ]);
});

it("given non-stocked vinaigrette, when a run is attempted, then it is rejected with no movement", async () => {
  const { production, audits, record } = harness(vinaigrette());
  production.rememberPolicy(TENANT_ID, VINAIGRETTE_ID, consumedAverage);

  await expect(
    record.execute(
      command({
        recipeId: VINAIGRETTE_ID,
        runId: "run_vinaigrette",
        expectedQuantity: 200,
        actualQuantity: 200,
      }),
    ),
  ).rejects.toThrow(PreparationNotStocked);
  expect(production.appended).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(production.afterSales()).toEqual([]);
});

it("given a recorded run, when the same runId is registered again, then it is a no-op", async () => {
  const { production, audits, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(10000));
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(10000));

  const first = await record.execute(command());
  const second = await record.execute(command());

  expect(second).toEqual(first);
  expect(production.appended).toHaveLength(1);
  expect(audits.commands).toHaveLength(1);
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(4000),
  );
  expect(await production.balance(TENANT_ID, LOCATION_ID, ONION_ID)).toBe(
    grams(9500),
  );
});

it("given tomato below the required quantity, when a run is registered, then it succeeds, tomato goes negative, and an alert opens", async () => {
  const { production, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(1000));
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(5000));

  const run = await record.execute(command({ runId: "run_short" }));

  expect(run.movements.some((movement) => movement.quantity < 0)).toBe(true);
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(-5000),
  );
  expect(await production.hasOpenAlert(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    true,
  );
  expect(await production.hasOpenAlert(TENANT_ID, LOCATION_ID, ONION_ID)).toBe(
    false,
  );
  expect(production.appended[0]?.alerts).toEqual([
    {
      type: "NegativeStockOpened",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      balance: grams(-5000),
      occurredAt: OCCURRED_AT,
    },
  ]);
});

it("given actual output 0, when the batch is registered, then ingredients are consumed and no output is written", async () => {
  const { production, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);
  production.rememberBalance(TENANT_ID, LOCATION_ID, SAUCE_ID, grams(1000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, SAUCE_ID, 9);
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(10000));
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(10000));

  const run = await record.execute(
    command({ runId: "run_burned", actualQuantity: 0 }),
  );

  expect(run.variance).toBe(-5000);
  expect(run.outputUnitCost).toBeNull();
  expect(
    run.movements.some(
      (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    ),
  ).toBe(false);
  expect(run.movements.map((movement) => movement.ingredientId)).toEqual([
    ONION_ID,
    TOMATO_ID,
  ]);
  expect(await production.balance(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    grams(1000),
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    9,
  );
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(4000),
  );
});

it("given consumed inputs cost 24000 COP, when actual output is 4000 g, then output cost is 6 and the preparation average uses nextAverageCost", async () => {
  const { production, record } = harness(costedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(10000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, TOMATO_ID, 4);
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(10000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, ONION_ID, 6);
  production.rememberBalance(TENANT_ID, LOCATION_ID, SAUCE_ID, grams(5000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, SAUCE_ID, 2);

  const run = await record.execute(
    command({
      runId: "run_average",
      expectedQuantity: 4000,
      actualQuantity: 4000,
    }),
  );
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );

  expect(run.outputUnitCost).toBe(6);
  expect(output?.unitCost).toBe(6);
  expect(output?.quantity).toBe(grams(4000));
  expect(output?.ingredientId).toBe(SAUCE_ID);
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    4,
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, ONION_ID)).toBe(
    6,
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    nextAverageCost({
      onHand: grams(5000),
      averageCost: 2,
      receivedQuantity: grams(4000),
      receiptCost: 6,
    }),
  );
  expect(production.appended[0]?.alerts).toEqual([]);
});

it("given a standard cost of 5 COP/g, when actual output is 4000 g, then output cost is 5 and input costs stay", async () => {
  const { production, record } = harness(costedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, {
    costRule: PRODUCTION_COST_RULE.STANDARD,
    standardUnitCost: 5,
  });
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(10000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, TOMATO_ID, 4);
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(10000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, ONION_ID, 6);

  const run = await record.execute(
    command({
      runId: "run_standard",
      expectedQuantity: 4000,
      actualQuantity: 4000,
    }),
  );
  const tomato = run.movements.find(
    (movement) => movement.ingredientId === TOMATO_ID,
  );
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );

  expect(run.outputUnitCost).toBe(5);
  expect(output?.unitCost).toBe(5);
  expect(tomato?.unitCost).toBe(4);
  expect(tomato?.quantity).toBe(grams(-3000));
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    nextAverageCost({
      onHand: 0,
      averageCost: 0,
      receivedQuantity: grams(4000),
      receiptCost: 5,
    }),
  );
});

it("given no cost policy, when a run is attempted, then it is rejected with no movement", async () => {
  const { production, audits, record } = harness(versionedSauce());

  await expect(
    record.execute(command({ runId: "run_no_policy" })),
  ).rejects.toThrow(MissingProductionCostPolicy);
  expect(production.appended).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given an unknown location, when a run is attempted, then it is rejected with no movement", async () => {
  const { production, audits, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);

  await expect(
    record.execute(
      command({ runId: "run_location", locationId: "location_missing" }),
    ),
  ).rejects.toThrow(UnknownProductionLocation);
  expect(production.appended).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given a venue without a brand, when a run is attempted, then it is rejected with no movement", async () => {
  const { production, audits, record } = harness(versionedSauce());
  production.rememberPolicy(TENANT_ID, SAUCE_ID, consumedAverage);

  await expect(
    record.execute(
      command({ runId: "run_venue", venueId: "organization_venue_other" }),
    ),
  ).rejects.toThrow(UnknownVenue);
  expect(production.appended).toEqual([]);
  expect(audits.commands).toEqual([]);
});
