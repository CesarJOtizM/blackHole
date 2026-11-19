import type { DrizzleShortageRepository } from "@blackhole/inventory/adapters/postgres/drizzle-shortage-repository";
import type { PublishedPurchaseFactor } from "@blackhole/inventory/application/ports/published-purchase-factor";
import type { SupplyingLocations } from "@blackhole/inventory/application/ports/supplying-locations";

export interface RestockFact {
  purchaseUnit: number;
  warehouseIds: readonly string[];
}

export class RestockFacts {
  constructor(
    private readonly shortages: DrizzleShortageRepository,
    private readonly factors: PublishedPurchaseFactor,
    private readonly supplying: SupplyingLocations,
  ) {}

  async read(
    tenantId: string,
    venueId: string,
    alertId: string,
  ): Promise<RestockFact> {
    const warehouseIds = await this.supplying.locationIds(tenantId, venueId);
    const alert = await this.shortages.findLevelAlert(tenantId, alertId);

    if (alert === null) {
      return { purchaseUnit: 1, warehouseIds };
    }

    return {
      purchaseUnit: await this.factors.factorOf(tenantId, alert.ingredientId),
      warehouseIds,
    };
  }
}
