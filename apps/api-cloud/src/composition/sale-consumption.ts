import type { ShortageNotice } from "@blackhole/contracts";
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

export interface RecordedNegativeStockNotice {
  alertId: string;
  kind: "level";
  severity: "critical";
  role: "siteAdministrator";
  venueId: string;
  tenantId: string;
  locationId: string;
  ingredientId: string;
}

const screenNotice = (notice: RecordedNegativeStockNotice): ShortageNotice => ({
  alertId: notice.alertId,
  kind: notice.kind,
  severity: notice.severity,
  role: notice.role,
  venueId: notice.venueId,
});

const negativeStockAlertId = (event: NegativeStockOpenedEvent): string =>
  `negative-stock:${event.locationId}:${event.ingredientId}`;

const sameOpenAlert = (
  stored: RecordedNegativeStockNotice,
  event: NegativeStockOpenedEvent,
): boolean =>
  stored.tenantId === event.tenantId &&
  stored.locationId === event.locationId &&
  stored.ingredientId === event.ingredientId;

export class NegativeStockNoticeLog {
  readonly notices: RecordedNegativeStockNotice[] = [];

  record(event: NegativeStockOpenedEvent): void {
    if (this.notices.some((stored) => sameOpenAlert(stored, event))) {
      return;
    }

    this.notices.push({
      alertId: negativeStockAlertId(event),
      kind: "level",
      severity: "critical",
      role: "siteAdministrator",
      venueId: event.venueId,
      tenantId: event.tenantId,
      locationId: event.locationId,
      ingredientId: event.ingredientId,
    });
  }

  screenNotices(tenantId: string, venueId: string): ShortageNotice[] {
    return this.notices
      .filter(
        (notice) => notice.tenantId === tenantId && notice.venueId === venueId,
      )
      .map(screenNotice);
  }
}

export const negativeStockNotices = new NegativeStockNoticeLog();

export const negativeStockScreenNotices = (
  tenantId: string,
  venueId: string,
): ShortageNotice[] => negativeStockNotices.screenNotices(tenantId, venueId);

export class StoredStockAlertPublisher extends StockAlertPublisher {
  constructor(
    private readonly notices: NegativeStockNoticeLog = negativeStockNotices,
  ) {
    super();
  }

  override async publish(event: NegativeStockOpenedEvent): Promise<void> {
    this.notices.record(event);
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
