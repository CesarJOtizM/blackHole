export const INVENTORY_LOCATION_KIND = {
  POINT: "point",
  WAREHOUSE: "warehouse",
} as const;

export type InventoryLocationKind =
  (typeof INVENTORY_LOCATION_KIND)[keyof typeof INVENTORY_LOCATION_KIND];

export interface InventoryLocation {
  id: string;
  kind: InventoryLocationKind;
}

export abstract class InventoryLocationDirectory {
  abstract find(
    tenantId: string,
    locationId: string,
  ): Promise<InventoryLocation | null>;
}
