export abstract class PointOfSaleDirectory {
  abstract locationOf(tenantId: string, venueId: string): Promise<string>;
}
