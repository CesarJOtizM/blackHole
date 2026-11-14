export abstract class SupplyingLocations {
  abstract locationIds(
    tenantId: string,
    siteId: string,
  ): Promise<readonly string[]>;
}
