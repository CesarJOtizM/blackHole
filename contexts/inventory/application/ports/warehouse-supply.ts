export abstract class WarehouseSupply {
  abstract linked(
    tenantId: string,
    venueId: string,
    warehouseLocationId: string,
  ): Promise<boolean>;
}
