import { InMemoryProducibleQuantityRepository } from "@blackhole/inventory/adapters/memory/in-memory-producible-quantity-repository";
import { InMemoryStockLedgerRepository } from "@blackhole/inventory/adapters/memory/in-memory-stock-ledger-repository";
import type { ExplodeRecipeInput } from "@blackhole/inventory/application/entry-port";
import {
  ExplodeRecipe,
  ProjectProducibleQuantity,
} from "@blackhole/inventory/application/entry-port";
import { AvailabilityPublisher } from "@blackhole/inventory/application/ports/availability-publisher";
import { LowUnitsThreshold } from "@blackhole/inventory/application/ports/low-units-threshold";
import { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import type { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import {
  CONSUMPTION_ROLE,
  type LedgerLine,
} from "@blackhole/inventory/application/ports/stock-ledger-repository";
import { SupplyingLocations } from "@blackhole/inventory/application/ports/supplying-locations";
import { VenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import { MOVEMENT_TYPE, QUANTITY_SCALE } from "@blackhole/inventory/domain";
import { expect, it } from "vitest";

import { ProjectAffectedProducts } from "#src/composition/project-affected-products.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const POINT_ID = "location_point_of_sale";
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

class FixedPoint extends PointOfSaleDirectory {
  override locationOf(): Promise<string> {
    return Promise.resolve(POINT_ID);
  }
}

class FixedBrand extends VenueDirectory {
  override brandOf(): Promise<string | null> {
    return Promise.resolve(BRAND_ID);
  }
}

class NoWarehouses extends SupplyingLocations {
  override locationIds(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

class OpenThreshold extends LowUnitsThreshold {
  override thresholdOf(): Promise<number | null> {
    return Promise.resolve(null);
  }
}

class SilentAvailability extends AvailabilityPublisher {
  override publish(): Promise<void> {
    return Promise.resolve();
  }
}

const receiptLine = (): LedgerLine => ({
  id: "movement_receipt_1",
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: POINT_ID,
  ingredientId: BEEF_ID,
  quantity: QUANTITY_SCALE,
  unitCost: 1,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: "receipt_1",
  occurredAt: "2026-11-19T17:00:00.000Z",
  orderLineId: "",
  role: CONSUMPTION_ROLE.CONSUMPTION,
  recipeVersion: 0,
  reason: null,
  actorId: "user_receiver",
});

it("given a receipt that increases the limiting ingredient, when it is stored, then the product availability is recalculated", async () => {
  const ledger = new InMemoryStockLedgerRepository();
  const projections = new InMemoryProducibleQuantityRepository();
  const projector = new ProjectProducibleQuantity(
    new OneIngredient(),
    new FixedBrand(),
    new FixedPoint(),
    ledger,
    projections,
    new NoWarehouses(),
    new OpenThreshold(),
    new SilentAvailability(),
  );
  await projections.replaceIndex(
    TENANT_ID,
    VENUE_ID,
    {
      productId: BURGER_ID,
      variantId: null,
    },
    [BEEF_ID],
  );
  await projector.execute({
    kind: "stock",
    tenantId: TENANT_ID,
    siteId: VENUE_ID,
    locationId: POINT_ID,
    ingredientId: BEEF_ID,
  });
  const before = await projections.find(TENANT_ID, VENUE_ID, {
    productId: BURGER_ID,
    variantId: null,
  });
  await ledger.append({ movements: [receiptLine()], alerts: [] });

  await new ProjectAffectedProducts((tenantId) =>
    tenantId === TENANT_ID ? projector : { execute: () => Promise.resolve() },
  ).afterReceipt({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    locationId: POINT_ID,
    ingredientIds: [BEEF_ID],
  });

  const after = await projections.find(TENANT_ID, VENUE_ID, {
    productId: BURGER_ID,
    variantId: null,
  });

  expect(before?.state).toBe("sold_out");
  expect(before?.pointUnits).toBe(0);
  expect(after?.state).toBe("available");
  expect(after?.pointUnits).toBe(1);
});
