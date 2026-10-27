import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import type { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";

export class OrganizationVenueDirectory extends VenueDirectory {
  constructor(private readonly organizations: OrganizationRepository) {
    super();
  }

  override async brandOf(
    tenantId: string,
    venueId: string,
  ): Promise<string | null> {
    const organization = await this.organizations.load(tenantId);
    const venue = organization?.venues.find((item) => item.id === venueId);

    return venue?.brandId ?? null;
  }
}
