import { SupplyingLocations } from "@blackhole/inventory/application/ports/supplying-locations";

type SupplySql = {
  exec(statement: string): Promise<unknown>;
  query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

export type WarehouseSupplyDatabase = {
  transaction<T>(work: (tx: SupplySql) => Promise<T>): Promise<T>;
};

interface SupplyRow extends Record<string, unknown> {
  warehouse_location_id: string;
  venue_id: string;
}

const missingSupplyStore = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("warehouse_supplies") ||
    error.message.includes("organization_app"));

export class WarehouseSupplyLocations extends SupplyingLocations {
  constructor(private readonly client: WarehouseSupplyDatabase) {
    super();
  }

  override async locationIds(
    tenantId: string,
    siteId: string,
  ): Promise<readonly string[]> {
    try {
      const rows = await this.inTenant(tenantId, (tx) =>
        tx.query<SupplyRow>(
          `SELECT warehouse_location_id
           FROM warehouse_supplies
           WHERE tenant_id = $1 AND venue_id = $2
           ORDER BY warehouse_location_id`,
          [tenantId, siteId],
        ),
      );

      return rows.map((row) => row.warehouse_location_id);
    } catch (error: unknown) {
      if (missingSupplyStore(error)) {
        return [];
      }

      throw error;
    }
  }

  async venueIdsFor(
    tenantId: string,
    warehouseLocationId: string,
  ): Promise<readonly string[]> {
    try {
      const rows = await this.inTenant(tenantId, (tx) =>
        tx.query<SupplyRow>(
          `SELECT venue_id
           FROM warehouse_supplies
           WHERE tenant_id = $1 AND warehouse_location_id = $2
           ORDER BY venue_id`,
          [tenantId, warehouseLocationId],
        ),
      );

      return rows.map((row) => row.venue_id);
    } catch (error: unknown) {
      if (missingSupplyStore(error)) {
        return [];
      }

      throw error;
    }
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: SupplySql) => Promise<{ rows: T[] }>,
  ): Promise<T[]> {
    return this.client.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE organization_app");
      await tx.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      const selected = await work(tx);

      return selected.rows;
    });
  }
}
