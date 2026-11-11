export abstract class VenueDirectory {
  abstract brandOf(tenantId: string, venueId: string): Promise<string | null>;
}
