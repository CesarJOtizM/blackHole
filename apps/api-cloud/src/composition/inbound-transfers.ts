import type { WarehouseSupplyDatabase } from "#src/composition/warehouse-supply-locations.js";

type TransferSql = {
  exec(statement: string): Promise<unknown>;
  query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

export interface InboundTransferStatus {
  status: string;
}

export interface InboundTransferReader {
  statuses(
    tenantId: string,
    venueId: string,
  ): Promise<readonly InboundTransferStatus[]>;
}

export const noInboundTransfers: InboundTransferReader = {
  statuses: () => Promise.resolve([]),
};

interface StatusRow extends Record<string, unknown> {
  status: string;
}

const missingTransferStore = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("transfers") ||
    error.message.includes("inventory_app"));

export class PostgresInboundTransfers implements InboundTransferReader {
  constructor(
    private readonly client: WarehouseSupplyDatabase,
    private readonly locationIds: (
      tenantId: string,
      venueId: string,
    ) => Promise<readonly string[]>,
  ) {}

  async statuses(
    tenantId: string,
    venueId: string,
  ): Promise<readonly InboundTransferStatus[]> {
    const locations = [...new Set(await this.locationIds(tenantId, venueId))];

    if (locations.length === 0) {
      return [];
    }

    const placeholders = locations
      .map((_, index) => `$${index + 2}`)
      .join(", ");

    try {
      const rows = await this.inTenant(tenantId, (tx) =>
        tx.query<StatusRow>(
          `SELECT status
           FROM transfers
           WHERE tenant_id = $1
             AND destination_location_id IN (${placeholders})
             AND status = 'in_transit'
           ORDER BY id`,
          [tenantId, ...locations],
        ),
      );

      return rows.map((row) => ({ status: row.status }));
    } catch (error: unknown) {
      if (missingTransferStore(error)) {
        return [];
      }

      throw error;
    }
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: TransferSql) => Promise<{ rows: T[] }>,
  ): Promise<T[]> {
    return this.client.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE inventory_app");
      await tx.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      const selected = await work(tx);

      return selected.rows;
    });
  }
}
