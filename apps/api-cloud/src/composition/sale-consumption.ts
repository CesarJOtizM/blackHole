import { UnknownRecipeVersion } from "@blackhole/inventory/application/entry-port";
import { OperationGeneration } from "@blackhole/inventory/application/ports/operation-generation";
import type { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import {
  type RecipeVersionQuery,
  RecipeVersionReader,
} from "@blackhole/inventory/application/ports/recipe-version";
import { ReferenceCostList } from "@blackhole/inventory/application/ports/reference-cost";
import {
  type NegativeStockOpenedEvent,
  StockAlertPublisher,
} from "@blackhole/inventory/application/ports/stock-alert-publisher";
import { StaleGeneration } from "@blackhole/platform/application/entry-port";
import type { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import type { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";

export class CatalogRecipeVersionReader extends RecipeVersionReader {
  constructor(private readonly catalogs: RecipeCatalogRepository) {
    super();
  }

  override async current(input: RecipeVersionQuery): Promise<number | null> {
    const catalog = await this.catalogs.load(input.tenantId, input.brandId);

    if (catalog === null || catalog.currentVersion === 0) {
      return null;
    }

    try {
      const published = catalog.publishedVersion(catalog.currentVersion);
      const variantId = input.variantIds[0];
      const found = published.recipes.some((recipe) => {
        if (recipe.productId !== input.productId) {
          return false;
        }

        if (variantId === undefined) {
          return recipe.variantId === undefined;
        }

        return recipe.variantId === variantId;
      });

      return found ? published.number : null;
    } catch (error: unknown) {
      if (error instanceof UnknownRecipeVersion) {
        return null;
      }

      throw error;
    }
  }
}

export class CatalogReferenceCostList extends ReferenceCostList {
  constructor(
    private readonly catalogs: RecipeCatalogRepository,
    private readonly organizations: OrganizationRepository,
  ) {
    super();
  }

  override async costOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<number> {
    const organization = await this.organizations.load(tenantId);

    if (organization === null) {
      throw new Error(`No reference cost for ${ingredientId}.`);
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
        return ingredient.referenceCostCop;
      }
    }

    throw new Error(`No reference cost for ${ingredientId}.`);
  }
}

export class VenueOperationGeneration extends OperationGeneration {
  constructor(private readonly operations: VenueOperationRepository) {
    super();
  }

  override async assertCurrent(
    _tenantId: string,
    venueId: string,
    generation: number,
  ): Promise<void> {
    const operation = await this.operations.findByVenueId(venueId);

    if (operation === null) {
      throw new StaleGeneration();
    }

    operation.acceptWrite(generation);
  }
}

export class StoredStockAlertPublisher extends StockAlertPublisher {
  override async publish(_event: NegativeStockOpenedEvent): Promise<void> {
    // The ledger stores the open alert. Kitchen and cash screens are a later notice.
  }
}

export const currentGeneration = async (
  operations: VenueOperationRepository,
  venueId: string,
): Promise<number> => {
  const operation = await operations.findByVenueId(venueId);

  if (operation === null) {
    throw new StaleGeneration();
  }

  return operation.generation;
};
