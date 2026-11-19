import { InMemoryShortageRepository } from "@blackhole/inventory/adapters/memory/in-memory-shortage-repository";
import { InMemoryStockLedgerRepository } from "@blackhole/inventory/adapters/memory/in-memory-stock-ledger-repository";
import type { ExplodeRecipeInput } from "@blackhole/inventory/application/entry-port";
import { ExplodeRecipe } from "@blackhole/inventory/application/entry-port";
import { OperationGeneration } from "@blackhole/inventory/application/ports/operation-generation";
import { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import type { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import { RecipeVersionReader } from "@blackhole/inventory/application/ports/recipe-version";
import { ReferenceCostList } from "@blackhole/inventory/application/ports/reference-cost";
import { StockAlertPublisher } from "@blackhole/inventory/application/ports/stock-alert-publisher";
import { StockMovementQueue } from "@blackhole/inventory/application/ports/stock-movement-queue";
import { VenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import {
  LEVEL_SEVERITY,
  QUANTITY_SCALE,
  SHORTAGE_KIND,
} from "@blackhole/inventory/domain";
import { expect, it } from "vitest";

import { ProjectingSaleConsumption } from "#src/composition/projecting-stock.js";
import { levelsForCloud } from "#src/composition/stock-level-gate.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const BURGER_ID = "product_burger";

class OneIngredient extends ExplodeRecipe {
  constructor() {
    super({} as RecipeCatalogRepository);
  }

  override execute(
    _input: ExplodeRecipeInput,
  ): Promise<readonly { ingredientId: string; quantity: number }[]> {
    return Promise.resolve([
      { ingredientId: BEEF_ID, quantity: QUANTITY_SCALE },
    ]);
  }
}

class CurrentVersion extends RecipeVersionReader {
  override current(): Promise<number | null> {
    return Promise.resolve(1);
  }
}

class BeefCost extends ReferenceCostList {
  override costOf(): Promise<number> {
    return Promise.resolve(1_000);
  }
}

class FixedBrand extends VenueDirectory {
  override brandOf(): Promise<string | null> {
    return Promise.resolve(BRAND_ID);
  }
}

class FixedPoint extends PointOfSaleDirectory {
  override locationOf(): Promise<string> {
    return Promise.resolve(LOCATION_ID);
  }
}

class CurrentGeneration extends OperationGeneration {
  override assertCurrent(): Promise<void> {
    return Promise.resolve();
  }
}

class SilentAlerts extends StockAlertPublisher {
  override publish(): Promise<void> {
    return Promise.resolve();
  }
}

class SilentQueue extends StockMovementQueue {
  override enqueue(): Promise<void> {
    return Promise.resolve();
  }
}

const sale = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  generation: 1,
  orderLineId: "line_1",
  productId: BURGER_ID,
  variantIds: [] as readonly string[],
  modifierIds: [] as readonly string[],
  portions: 1,
  occurredAt: "2026-11-19T17:00:00.000Z",
};

it("given shortage alerts are on and beef is below its minimum, when a sale is registered, then that ingredient is evaluated at the point of sale", async () => {
  const shortages = new InMemoryShortageRepository();
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: BEEF_ID,
    maximum: 20 * QUANTITY_SCALE,
    reorderPoint: 15 * QUANTITY_SCALE,
    minimum: 8 * QUANTITY_SCALE,
  });
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const levels = levelsForCloud(true, shortages);
  const register = new ProjectingSaleConsumption(
    new OneIngredient(),
    new CurrentVersion(),
    new BeefCost(),
    new FixedBrand(),
    new FixedPoint(),
    new CurrentGeneration(),
    new InMemoryStockLedgerRepository(),
    new SilentAlerts(),
    new SilentQueue(),
    () => ({ execute: () => Promise.resolve() }),
    levels,
  );

  await register.execute(sale);

  const open = await shortages.listOpenShortages(TENANT_ID, VENUE_ID);
  expect(levelsForCloud(false, shortages)).toBeNull();
  expect(open).toHaveLength(1);
  expect(open[0]).toMatchObject({
    kind: SHORTAGE_KIND.LEVEL,
    alert: {
      ingredientId: BEEF_ID,
      locationId: LOCATION_ID,
      severity: LEVEL_SEVERITY.CRITICAL,
    },
  });
});
