import {
  type GuestToldQuery,
  type GuestToldRecord,
  GuestToldStore,
} from "@blackhole/orders/application/entry-port";

type GuestSql = {
  exec(statement: string): Promise<unknown>;
  query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

export type GuestToldDatabase = {
  transaction<T>(work: (tx: GuestSql) => Promise<T>): Promise<T>;
};

interface GuestToldSqlRow extends Record<string, unknown> {
  check_id: string;
  id: string;
  guest_told_actor_id: string | null;
}

export class PostgresGuestTold extends GuestToldStore {
  constructor(private readonly client: GuestToldDatabase) {
    super();
  }

  override async find(query: GuestToldQuery): Promise<GuestToldRecord | null> {
    const rows = await this.inTenant(query.tenantId, (tx) =>
      tx.query<GuestToldSqlRow>(
        `SELECT check_id, id, guest_told_actor_id
         FROM order_lines
         WHERE tenant_id = $1
           AND venue_id = $2
           AND check_id = $3
           AND id = $4
         LIMIT 1`,
        [query.tenantId, query.venueId, query.checkId, query.lineId],
      ),
    );
    const row = rows[0];

    if (row === undefined || row.guest_told_actor_id === null) {
      return null;
    }

    return {
      checkId: row.check_id,
      lineId: row.id,
      actorId: row.guest_told_actor_id,
    };
  }

  override async save(record: GuestToldQuery & GuestToldRecord): Promise<void> {
    await this.inTenant(record.tenantId, (tx) =>
      tx.query(
        `UPDATE order_lines
         SET guest_told_actor_id = $5
         WHERE tenant_id = $1
           AND venue_id = $2
           AND check_id = $3
           AND id = $4`,
        [
          record.tenantId,
          record.venueId,
          record.checkId,
          record.lineId,
          record.actorId,
        ],
      ),
    );
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: GuestSql) => Promise<{ rows: T[] }>,
  ): Promise<T[]> {
    return this.client.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE orders_app");
      await tx.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      const selected = await work(tx);

      return selected.rows;
    });
  }
}
