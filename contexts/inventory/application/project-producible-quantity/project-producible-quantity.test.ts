import { expect, it } from "vitest";

import type { ExplodeRecipeInput } from "#application/explode-recipe/explode-recipe.js";
import { ExplodeRecipe } from "#application/explode-recipe/explode-recipe.js";
import {
  type AvailabilityChanged,
  AvailabilityPublisher,
} from "#application/ports/availability-publisher.js";
import { LowUnitsThreshold } from "#application/ports/low-units-threshold.js";
import { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import {
  type ProducibleProduct,
  type ProducibleProjection,
  ProducibleQuantityRepository,
} from "#application/ports/producible-quantity-repository.js";
import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import {
  type AppendStock,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import { SupplyingLocations } from "#application/ports/supplying-locations.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import { ProjectProducibleQuantity } from "#application/project-producible-quantity/project-producible-quantity.js";
import type { AvailabilityState } from "#domain/producible-quantity.js";
import type { ExplodedQuantity } from "#domain/recipe-catalog.js";
import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const SITE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const POINT_ID = "location_point_of_sale";
const WAREHOUSE_A = "location_warehouse_site";
const WAREHOUSE_B = "location_warehouse_general";
const BEEF_ID = "ingredient_beef";
const BUN_ID = "ingredient_bun";
const LEMON_ID = "ingredient_lemon";
const CHEESE_ID = "ingredient_cheese";
const BUTTER_ID = "ingredient_butter";
const SAUCE_RECIPE_ID = "recipe_sauce";
const BURGER_ID = "product_burger";
const SANDWICH_ID = "product_sandwich";
const SODA_ID = "product_soda";
const VARIANT_ID = "variant_classic";
const AUTHOR_ID = "user_owner";
const CATALOG_ID = `recipe_catalog_${BRAND_ID}`;

const BASE_PRODUCT: ProducibleProduct = {
  productId: BURGER_ID,
  variantId: null,
};

const VARIANT_PRODUCT: ProducibleProduct = {
  productId: BURGER_ID,
  variantId: VARIANT_ID,
};

const lineKey = (productId: string, variantId?: string): string =>
  `${productId}\u0000${variantId ?? ""}`;

const thresholdKey = (productId: string, variantId: string | null): string =>
  `${productId}\u0000${variantId ?? ""}`;

const sameProduct = (
  left: ProducibleProduct,
  right: ProducibleProduct,
): boolean =>
  left.productId === right.productId && left.variantId === right.variantId;

class ScriptedExplosion extends ExplodeRecipe {
  readonly calls: ExplodeRecipeInput[] = [];

  constructor(
    private readonly lines: ReadonlyMap<string, readonly ExplodedQuantity[]>,
  ) {
    super({} as RecipeCatalogRepository);
  }

  override async execute(
    input: ExplodeRecipeInput,
  ): Promise<readonly ExplodedQuantity[]> {
    this.calls.push(input);
    const lines = this.lines.get(lineKey(input.productId, input.variantId));

    if (!lines) {
      throw new UnknownRecipe();
    }

    return lines;
  }
}

class CatalogExplosion extends ExplodeRecipe {
  readonly calls: ExplodeRecipeInput[] = [];

  constructor(private readonly catalog: RecipeCatalog) {
    super({} as RecipeCatalogRepository);
  }

  override async execute(
    input: ExplodeRecipeInput,
  ): Promise<readonly ExplodedQuantity[]> {
    this.calls.push(input);

    return this.catalog.explode({
      productId: input.productId,
      ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
      ...(input.version === undefined ? {} : { version: input.version }),
      ...(input.modifierIds === undefined
        ? {}
        : { modifierIds: input.modifierIds }),
    });
  }
}

class MemoryLedger extends StockLedgerRepository {
  appendCalls = 0;

  private readonly balances = new Map<string, number>();

  seed(locationId: string, ingredientId: string, quantity: number): void {
    this.balances.set(`${TENANT_ID}:${locationId}:${ingredientId}`, quantity);
  }

  override async findLine(
    _tenantId: string,
    _orderLineId: string,
    _role: LedgerLine["role"],
  ): Promise<readonly LedgerLine[]> {
    return [];
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.balances.get(`${tenantId}:${locationId}:${ingredientId}`) ?? 0;
  }

  override async hasOpenAlert(
    _tenantId: string,
    _locationId: string,
    _ingredientId: string,
  ): Promise<boolean> {
    return false;
  }

  override async append(_input: AppendStock): Promise<void> {
    this.appendCalls += 1;
  }

  override async listByVenue(): Promise<readonly LedgerLine[]> {
    return [];
  }
}

class MemoryProjections extends ProducibleQuantityRepository {
  private readonly byIngredient = new Map<string, ProducibleProduct[]>();

  private readonly rows = new Map<string, ProducibleProjection>();

  seedIndex(
    ingredientId: string,
    products: readonly ProducibleProduct[],
  ): void {
    this.byIngredient.set(this.ingredientKey(ingredientId), [...products]);
  }

  seed(projection: ProducibleProjection): void {
    this.rows.set(this.rowKey(projection), projection);
  }

  override async productsFor(
    tenantId: string,
    siteId: string,
    ingredientId: string,
  ): Promise<readonly ProducibleProduct[]> {
    return [
      ...(this.byIngredient.get(
        this.ingredientKey(ingredientId, tenantId, siteId),
      ) ?? []),
    ];
  }

  override async replaceIndex(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
    ingredientIds: readonly string[],
  ): Promise<void> {
    const prefix = `${tenantId}\u0000${siteId}\u0000`;

    for (const [key, products] of this.byIngredient) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const remaining = products.filter(
        (indexed) => !sameProduct(indexed, product),
      );

      if (remaining.length === 0) {
        this.byIngredient.delete(key);
      } else {
        this.byIngredient.set(key, remaining);
      }
    }

    for (const ingredientId of ingredientIds) {
      const key = this.ingredientKey(ingredientId, tenantId, siteId);
      const current = this.byIngredient.get(key) ?? [];
      this.byIngredient.set(key, [...current, product]);
    }
  }

  override async find(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
  ): Promise<ProducibleProjection | null> {
    return (
      this.rows.get(
        this.rowKey(
          {
            siteId,
            productId: product.productId,
            variantId: product.variantId,
            pointUnits: 0,
            replenishmentUnits: 0,
            limitingIngredientIds: [],
            state: "available",
          },
          tenantId,
        ),
      ) ?? null
    );
  }

  override async save(
    tenantId: string,
    projection: ProducibleProjection,
  ): Promise<void> {
    this.rows.set(this.rowKey(projection, tenantId), projection);
  }

  private ingredientKey(
    ingredientId: string,
    tenantId = TENANT_ID,
    siteId = SITE_ID,
  ): string {
    return `${tenantId}\u0000${siteId}\u0000${ingredientId}`;
  }

  private rowKey(
    projection: ProducibleProjection,
    tenantId = TENANT_ID,
  ): string {
    return `${tenantId}\u0000${projection.siteId}\u0000${projection.productId}\u0000${projection.variantId ?? ""}`;
  }
}

class MemoryPublisher extends AvailabilityPublisher {
  readonly notices: AvailabilityChanged[] = [];

  override async publish(notice: AvailabilityChanged): Promise<void> {
    this.notices.push(notice);
  }
}

class FixedPoint extends PointOfSaleDirectory {
  override async locationOf(): Promise<string> {
    return POINT_ID;
  }
}

class FixedBrand extends VenueDirectory {
  override async brandOf(): Promise<string | null> {
    return BRAND_ID;
  }
}

class FixedSupplying extends SupplyingLocations {
  constructor(private readonly ids: readonly string[]) {
    super();
  }

  override async locationIds(): Promise<readonly string[]> {
    return [...this.ids];
  }
}

class MapThreshold extends LowUnitsThreshold {
  constructor(private readonly values: ReadonlyMap<string, number | null>) {
    super();
  }

  override async thresholdOf(
    _tenantId: string,
    _siteId: string,
    productId: string,
    variantId: string | null,
  ): Promise<number | null> {
    return this.values.get(thresholdKey(productId, variantId)) ?? null;
  }
}

const projector = (
  recipes: ExplodeRecipe,
  ledger: MemoryLedger,
  projections: MemoryProjections,
  publisher: MemoryPublisher,
  supplying: readonly string[] = [],
  thresholds: ReadonlyMap<string, number | null> = new Map(),
): ProjectProducibleQuantity =>
  new ProjectProducibleQuantity(
    recipes,
    new FixedBrand(),
    new FixedPoint(),
    ledger,
    projections,
    new FixedSupplying(supplying),
    new MapThreshold(thresholds),
    publisher,
  );

const projection = (
  product: ProducibleProduct,
  pointUnits: number,
  replenishmentUnits: number,
  state: AvailabilityState,
  limitingIngredientIds: readonly string[],
): ProducibleProjection => ({
  siteId: SITE_ID,
  productId: product.productId,
  variantId: product.variantId,
  pointUnits,
  replenishmentUnits,
  limitingIngredientIds,
  state,
});

const expectCurrentExplode = (calls: readonly ExplodeRecipeInput[]): void => {
  for (const call of calls) {
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.brandId).toBe(BRAND_ID);
    expect(call.version).toBeUndefined();
    expect(call.modifierIds).toBeUndefined();
  }
};

const expectNotice = (
  notice: AvailabilityChanged,
  state: AvailabilityState,
  product: ProducibleProduct = BASE_PRODUCT,
): void => {
  expect(notice).toEqual({
    siteId: SITE_ID,
    productId: product.productId,
    variantId: product.variantId,
    state,
  });
  expect(Object.keys(notice).toSorted()).toEqual([
    "productId",
    "siteId",
    "state",
    "variantId",
  ]);
  expect(notice).not.toHaveProperty("cost");
};

const stock = (
  ingredientId: string,
  locationId = POINT_ID,
): {
  kind: "stock";
  tenantId: string;
  siteId: string;
  locationId: string;
  ingredientId: string;
} => ({
  kind: "stock",
  tenantId: TENANT_ID,
  siteId: SITE_ID,
  locationId,
  ingredientId,
});

const unitIngredient = (id: string, name: string) => ({
  id,
  name,
  baseUnit: BASE_UNIT.UNIT,
  purchaseUnit: { name: "unit", baseQuantity: 1 },
  recipeUnit: { name: "unit", baseQuantity: 1 },
  referenceCostCop: 0,
});

it("given a purchase of lemons at the point, when recalculation runs, then products without lemons are not re-evaluated", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [
      lineKey(BURGER_ID),
      [
        { ingredientId: BEEF_ID, quantity: 150 },
        { ingredientId: BUN_ID, quantity: 1 },
      ],
    ],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  const projections = new MemoryProjections();
  const publisher = new MemoryPublisher();
  const stored = projection(BASE_PRODUCT, 12, 12, "available", [BUN_ID]);
  projections.seedIndex(BEEF_ID, [BASE_PRODUCT]);
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(stored);
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute(stock(LEMON_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    stored,
  );
  expect(explosion.calls).toEqual([]);
  expect(publisher.notices).toEqual([]);
  expect(ledger.appendCalls).toBe(0);
});

it("given beef or buns change at the point, when recalculation runs, then every indexed product using that ingredient is recalculated", async () => {
  const sandwich: ProducibleProduct = {
    productId: SANDWICH_ID,
    variantId: null,
  };
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [
      lineKey(BURGER_ID),
      [
        { ingredientId: BEEF_ID, quantity: 150 },
        { ingredientId: BUN_ID, quantity: 1 },
      ],
    ],
    [lineKey(SANDWICH_ID), [{ ingredientId: BEEF_ID, quantity: 100 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BEEF_ID, 1_500);
  ledger.seed(POINT_ID, BUN_ID, 12);
  const projections = new MemoryProjections();
  projections.seedIndex(BEEF_ID, [BASE_PRODUCT, sandwich]);
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(projection(BASE_PRODUCT, 99, 99, "available", [BUN_ID]));
  projections.seed(projection(sandwich, 1, 1, "available", [BEEF_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute(stock(BEEF_ID));

  expect(explosion.calls.map((call) => call.productId).toSorted()).toEqual([
    BURGER_ID,
    SANDWICH_ID,
  ]);
  expectCurrentExplode(explosion.calls);
  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 10, 10, "available", [BEEF_ID]),
  );
  expect(await projections.find(TENANT_ID, SITE_ID, sandwich)).toEqual(
    projection(sandwich, 15, 15, "available", [BEEF_ID]),
  );
  expect(publisher.notices).toEqual([]);
  const afterBeef = explosion.calls.length;

  ledger.seed(POINT_ID, BUN_ID, 8);
  await project.execute(stock(BUN_ID));

  expect(
    explosion.calls.slice(afterBeef).map((call) => call.productId),
  ).toEqual([BURGER_ID]);
  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 8, 8, "available", [BUN_ID]),
  );
  expect(await projections.find(TENANT_ID, SITE_ID, sandwich)).toEqual(
    projection(sandwich, 15, 15, "available", [BEEF_ID]),
  );
  expect(ledger.appendCalls).toBe(0);
});

it("given a new recipe version is published, when that product is projected, then the current explode replaces the previous result", async () => {
  const catalog = RecipeCatalog.open({
    id: CATALOG_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });
  catalog.upsertIngredient(unitIngredient(BEEF_ID, "beef"));
  catalog.upsertIngredient(unitIngredient(BUN_ID, "bun"));
  catalog.upsertRecipe({
    id: "recipe_burger",
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: BEEF_ID,
        netQuantity: 150,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: BUN_ID,
        netQuantity: 1,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  const explosion = new CatalogExplosion(catalog);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BEEF_ID, 3_000 * QUANTITY_SCALE);
  ledger.seed(POINT_ID, BUN_ID, 12 * QUANTITY_SCALE);
  const projections = new MemoryProjections();
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute({
    kind: "recipe",
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    productId: BURGER_ID,
  });

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 12, 12, "available", [BUN_ID]),
  );
  expect(await projections.productsFor(TENANT_ID, SITE_ID, BUN_ID)).toEqual([
    BASE_PRODUCT,
  ]);
  catalog.upsertIngredient(unitIngredient(CHEESE_ID, "cheese"));
  catalog.upsertRecipe({
    id: "recipe_burger",
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: BEEF_ID,
        netQuantity: 300,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: CHEESE_ID,
        netQuantity: 1,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  ledger.seed(POINT_ID, CHEESE_ID, 4 * QUANTITY_SCALE);
  const noticesAfterFirst = publisher.notices.length;

  await project.execute({
    kind: "recipe",
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    productId: BURGER_ID,
  });

  expectCurrentExplode(explosion.calls);
  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 4, 4, "available", [CHEESE_ID]),
  );
  expect(await projections.productsFor(TENANT_ID, SITE_ID, BUN_ID)).toEqual([]);
  expect(await projections.productsFor(TENANT_ID, SITE_ID, CHEESE_ID)).toEqual([
    BASE_PRODUCT,
  ]);
  expect(publisher.notices).toHaveLength(noticesAfterFirst);
  const afterVersion = explosion.calls.length;

  await project.execute(stock(BUN_ID));
  await project.execute(stock(CHEESE_ID));

  expect(
    explosion.calls.slice(afterVersion).map((call) => call.productId),
  ).toEqual([BURGER_ID]);
  expect(ledger.appendCalls).toBe(0);
});

it("given no threshold and 30 available units, when units drop to 29, then the state stays available and nothing is emitted", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [lineKey(BURGER_ID), [{ ingredientId: BUN_ID, quantity: 1 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BUN_ID, 29);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(projection(BASE_PRODUCT, 30, 30, "available", [BUN_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute(stock(BUN_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 29, 29, "available", [BUN_ID]),
  );
  expect(publisher.notices).toEqual([]);
  expect(ledger.appendCalls).toBe(0);
});

it("given the threshold is 5 and point units drop from 6 to 5, when the state is derived, then one low_units event is emitted", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [lineKey(BURGER_ID, VARIANT_ID), [{ ingredientId: BUN_ID, quantity: 1 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BUN_ID, 5);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [VARIANT_PRODUCT]);
  projections.seed(projection(VARIANT_PRODUCT, 6, 6, "available", [BUN_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(
    explosion,
    ledger,
    projections,
    publisher,
    [],
    new Map([[thresholdKey(BURGER_ID, VARIANT_ID), 5]]),
  );

  await project.execute(stock(BUN_ID));

  expect(publisher.notices).toHaveLength(1);
  expectNotice(
    publisher.notices[0] as AvailabilityChanged,
    "low_units",
    VARIANT_PRODUCT,
  );
  expect(await projections.find(TENANT_ID, SITE_ID, VARIANT_PRODUCT)).toEqual(
    projection(VARIANT_PRODUCT, 5, 5, "low_units", [BUN_ID]),
  );
  expect(ledger.appendCalls).toBe(0);
});

it("given point units are under the threshold, when the state is derived, then it is low_units", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [lineKey(BURGER_ID), [{ ingredientId: BUN_ID, quantity: 1 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BUN_ID, 4);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(projection(BASE_PRODUCT, 6, 6, "available", [BUN_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(
    explosion,
    ledger,
    projections,
    publisher,
    [],
    new Map([[thresholdKey(BURGER_ID, null), 5]]),
  );

  await project.execute(stock(BUN_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 4, 4, "low_units", [BUN_ID]),
  );
  expect(publisher.notices).toHaveLength(1);
  expectNotice(publisher.notices[0] as AvailabilityChanged, "low_units");
  expect(ledger.appendCalls).toBe(0);
});

it("given point units are 0, when the state is derived, then it is sold_out", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [lineKey(BURGER_ID), [{ ingredientId: BUN_ID, quantity: 1 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BUN_ID, 0);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(projection(BASE_PRODUCT, 2, 2, "available", [BUN_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(
    explosion,
    ledger,
    projections,
    publisher,
    [],
    new Map([[thresholdKey(BURGER_ID, null), 5]]),
  );

  await project.execute(stock(BUN_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 0, 0, "sold_out", [BUN_ID]),
  );
  expect(publisher.notices).toHaveLength(1);
  expectNotice(publisher.notices[0] as AvailabilityChanged, "sold_out");
  expect(ledger.appendCalls).toBe(0);
});

it("given supplying locations hold stock, when the point is at the threshold, then the menu state follows the point", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [
      lineKey(BURGER_ID),
      [
        { ingredientId: BEEF_ID, quantity: 150 },
        { ingredientId: BUN_ID, quantity: 1 },
      ],
    ],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BEEF_ID, 3_000);
  ledger.seed(POINT_ID, BUN_ID, 12);
  ledger.seed(WAREHOUSE_A, BEEF_ID, 6_000);
  ledger.seed(WAREHOUSE_A, BUN_ID, 40);
  ledger.seed(WAREHOUSE_B, BEEF_ID, 6_000);
  ledger.seed(WAREHOUSE_B, BUN_ID, 10);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seed(projection(BASE_PRODUCT, 20, 20, "available", [BUN_ID]));
  const publisher = new MemoryPublisher();
  const project = projector(
    explosion,
    ledger,
    projections,
    publisher,
    [WAREHOUSE_A, WAREHOUSE_B],
    new Map([[thresholdKey(BURGER_ID, null), 12]]),
  );

  await project.execute(stock(BUN_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 12, 62, "low_units", [BUN_ID]),
  );
  expect(publisher.notices).toHaveLength(1);
  expectNotice(publisher.notices[0] as AvailabilityChanged, "low_units");
  expect(ledger.appendCalls).toBe(0);
});

it("given a warehouse balance changes, when recalculation runs, then replenishment updates and the menu state stays", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [
      lineKey(BURGER_ID),
      [
        { ingredientId: BEEF_ID, quantity: 150 },
        { ingredientId: BUN_ID, quantity: 1 },
      ],
    ],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BEEF_ID, 3_000);
  ledger.seed(POINT_ID, BUN_ID, 12);
  ledger.seed(WAREHOUSE_A, BEEF_ID, 6_000);
  ledger.seed(WAREHOUSE_A, BUN_ID, 40);
  ledger.seed(WAREHOUSE_B, BEEF_ID, 6_000);
  ledger.seed(WAREHOUSE_B, BUN_ID, 10);
  const projections = new MemoryProjections();
  projections.seedIndex(BUN_ID, [BASE_PRODUCT]);
  projections.seedIndex(BEEF_ID, [BASE_PRODUCT]);
  const stored = projection(BASE_PRODUCT, 12, 12, "available", [BUN_ID]);
  projections.seed(stored);
  const publisher = new MemoryPublisher();
  const project = projector(
    explosion,
    ledger,
    projections,
    publisher,
    [WAREHOUSE_A, WAREHOUSE_B],
    new Map([[thresholdKey(BURGER_ID, null), 12]]),
  );

  await project.execute(stock(BUN_ID, WAREHOUSE_A));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual({
    ...stored,
    replenishmentUnits: 62,
  });
  expect(publisher.notices).toEqual([]);
  expect(ledger.appendCalls).toBe(0);
});

it("given a bottled soda has no recipe, when availability is derived, then no inventory state is stored", async () => {
  const explosion = new ScriptedExplosion(new Map());
  const ledger = new MemoryLedger();
  const projections = new MemoryProjections();
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute({
    kind: "recipe",
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    productId: SODA_ID,
  });

  expect(
    await projections.find(TENANT_ID, SITE_ID, {
      productId: SODA_ID,
      variantId: null,
    }),
  ).toBeNull();
  expect(await projections.productsFor(TENANT_ID, SITE_ID, LEMON_ID)).toEqual(
    [],
  );
  expect(publisher.notices).toEqual([]);
  expect(ledger.appendCalls).toBe(0);
});

it("given a stocked preparation, when the product is projected, then the explode recipe id limits producible units", async () => {
  const catalog = RecipeCatalog.open({
    id: CATALOG_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });
  catalog.upsertIngredient({
    id: BUTTER_ID,
    name: "butter",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 0,
  });
  catalog.upsertIngredient(unitIngredient(BUN_ID, "bun"));
  catalog.upsertRecipe({
    id: SAUCE_RECIPE_ID,
    name: "sauce",
    productId: "product_sauce",
    lines: [
      {
        kind: "ingredient",
        ingredientId: BUTTER_ID,
        netQuantity: 40,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: "recipe_burger",
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_RECIPE_ID,
        netQuantity: 1,
        yieldPercent: 100,
        stocked: true,
      },
      {
        kind: "ingredient",
        ingredientId: BUN_ID,
        netQuantity: 1,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  const explosion = new CatalogExplosion(catalog);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, SAUCE_RECIPE_ID, 3 * QUANTITY_SCALE);
  ledger.seed(POINT_ID, BUN_ID, 12 * QUANTITY_SCALE);
  ledger.seed(POINT_ID, BUTTER_ID, 10_000 * QUANTITY_SCALE);
  const projections = new MemoryProjections();
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher);

  await project.execute({
    kind: "recipe",
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    productId: BURGER_ID,
  });

  expectCurrentExplode(explosion.calls);
  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 3, 3, "available", [SAUCE_RECIPE_ID]),
  );
  expect(
    await projections.productsFor(TENANT_ID, SITE_ID, SAUCE_RECIPE_ID),
  ).toEqual([BASE_PRODUCT]);
  expect(await projections.productsFor(TENANT_ID, SITE_ID, BUTTER_ID)).toEqual(
    [],
  );
  const afterPublish = explosion.calls.length;

  await project.execute(stock(BUTTER_ID));

  expect(explosion.calls).toHaveLength(afterPublish);
  expect(ledger.appendCalls).toBe(0);
});

it("given stock, warehouse, and recipe recalculation, when the projector finishes, then the ledger append is never called", async () => {
  const lines = new Map<string, readonly ExplodedQuantity[]>([
    [lineKey(BURGER_ID), [{ ingredientId: BUN_ID, quantity: 1 }]],
  ]);
  const explosion = new ScriptedExplosion(lines);
  const ledger = new MemoryLedger();
  ledger.seed(POINT_ID, BUN_ID, 12);
  ledger.seed(WAREHOUSE_A, BUN_ID, 40);
  const projections = new MemoryProjections();
  const publisher = new MemoryPublisher();
  const project = projector(explosion, ledger, projections, publisher, [
    WAREHOUSE_A,
  ]);

  await project.execute({
    kind: "recipe",
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    productId: BURGER_ID,
  });
  await project.execute(stock(BUN_ID));
  await project.execute(stock(BUN_ID, WAREHOUSE_A));
  await project.execute(stock(LEMON_ID));

  expect(await projections.find(TENANT_ID, SITE_ID, BASE_PRODUCT)).toEqual(
    projection(BASE_PRODUCT, 12, 52, "available", [BUN_ID]),
  );
  expect(ledger.appendCalls).toBe(0);
});
