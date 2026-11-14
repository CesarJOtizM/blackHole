import type { DrizzlePurchasingRepository } from "@blackhole/inventory/adapters/postgres/drizzle-purchasing-repository";
import {
  INVENTORY_LOCATION_KIND,
  type InventoryLocation,
  InventoryLocationDirectory,
} from "@blackhole/inventory/application/ports/inventory-location-directory";
import { PublishedPurchaseFactor } from "@blackhole/inventory/application/ports/published-purchase-factor";
import type { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import type { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";

export class UnpublishedPurchaseFactor extends Error {
  constructor() {
    super("That ingredient has no published purchase factor.");
    this.name = "UnpublishedPurchaseFactor";
  }
}

export class OrganizationInventoryLocationDirectory extends InventoryLocationDirectory {
  constructor(private readonly organizations: OrganizationRepository) {
    super();
  }

  override async find(
    tenantId: string,
    locationId: string,
  ): Promise<InventoryLocation | null> {
    const organization = await this.organizations.load(tenantId);
    const location = organization?.locations.find(
      (item) => item.id === locationId,
    );

    if (!location) {
      return null;
    }

    if (location.kind === INVENTORY_LOCATION_KIND.WAREHOUSE) {
      return { id: location.id, kind: INVENTORY_LOCATION_KIND.WAREHOUSE };
    }

    if (location.kind === INVENTORY_LOCATION_KIND.POINT) {
      return { id: location.id, kind: INVENTORY_LOCATION_KIND.POINT };
    }

    return null;
  }
}

export class CatalogPublishedPurchaseFactor extends PublishedPurchaseFactor {
  constructor(
    private readonly catalogs: RecipeCatalogRepository,
    private readonly organizations: OrganizationRepository,
  ) {
    super();
  }

  override async factorOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<number> {
    const organization = await this.organizations.load(tenantId);

    if (organization === null) {
      throw new UnpublishedPurchaseFactor();
    }

    for (const brand of organization.brands) {
      const catalog = await this.catalogs.load(tenantId, brand.id);

      if (catalog === null || catalog.currentVersion === 0) {
        continue;
      }

      const ingredient = catalog
        .publishedVersion(catalog.currentVersion)
        .ingredients.find((item) => item.id === ingredientId);

      if (ingredient) {
        return ingredient.purchaseUnit.factor;
      }
    }

    throw new UnpublishedPurchaseFactor();
  }
}

export abstract class PurchaseAverageCost {
  abstract costOf(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
}

export class PostgresPurchaseAverageCost extends PurchaseAverageCost {
  constructor(private readonly purchasing: DrizzlePurchasingRepository) {
    super();
  }

  override costOf(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.purchasing.averageCost(tenantId, locationId, ingredientId);
  }
}
