import { VenueDirectory } from "#application/ports/venue-directory.js";

export class InMemoryVenueDirectory extends VenueDirectory {
  constructor(private readonly brands: Readonly<Record<string, string>>) {
    super();
  }

  override async brandOf(
    tenantId: string,
    venueId: string,
  ): Promise<string | null> {
    return this.brands[`${tenantId}:${venueId}`] ?? null;
  }
}
