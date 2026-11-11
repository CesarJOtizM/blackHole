import { VenueDirectory as RecipeVenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import type { VenueDirectory as OrdersVenueDirectory } from "@blackhole/orders/application/ports/venue-directory";

export class OrdersRecipeVenueDirectory extends RecipeVenueDirectory {
  constructor(private readonly venues: OrdersVenueDirectory) {
    super();
  }

  override async brandOf(
    tenantId: string,
    venueId: string,
  ): Promise<string | null> {
    return this.venues.brandOf(tenantId, venueId);
  }
}
