import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { qrTableSettings, tableQrTokens } from "#adapters/postgres/schema.js";
import {
  DEFAULT_STALE_AFTER_SECONDS,
  type QrAcceptance,
  type QrTableSettings,
  type TableQrRecord,
  TableQrRepository,
} from "#application/ports/table-qr-repository.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const defaultSettings = (
  tenantId: string,
  venueId: string,
): QrTableSettings => ({
  tenantId,
  venueId,
  enabled: true,
  acceptance: "direct",
  staleAfterSeconds: DEFAULT_STALE_AFTER_SECONDS,
});

const acceptanceOf = (value: string): QrAcceptance => {
  if (value === "direct" || value === "cash_register") {
    return value;
  }

  throw new Error("Stored QR acceptance is not direct or cash_register.");
};

export class DrizzleTableQrRepository extends TableQrRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async findByDigest(digest: string): Promise<TableQrRecord | null> {
    const result = await this.database.execute<{
      tenant_id: string;
      venue_id: string;
      table_id: string;
      digest: string;
      retired: boolean;
    }>(sql`SELECT tenant_id, venue_id, table_id, digest, retired
      FROM table_qr_find_digest(${digest})`);
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      venueId: row.venue_id,
      tableId: row.table_id,
      digest: row.digest,
      retired: row.retired,
    };
  }

  override async save(record: TableQrRecord): Promise<void> {
    await this.inTenant(record.tenantId, async (tx) => {
      await tx.insert(tableQrTokens).values(record);
    });
  }

  override async retireActive(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      await tx
        .update(tableQrTokens)
        .set({ retired: true })
        .where(
          and(
            eq(tableQrTokens.venueId, venueId),
            eq(tableQrTokens.tableId, tableId),
            eq(tableQrTokens.retired, false),
          ),
        );
    });
  }

  override async loadSettings(
    tenantId: string,
    venueId: string,
  ): Promise<QrTableSettings> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(qrTableSettings)
        .where(eq(qrTableSettings.venueId, venueId));
      const row = rows[0];

      if (row === undefined) {
        return defaultSettings(tenantId, venueId);
      }

      return {
        tenantId: row.tenantId,
        venueId: row.venueId,
        enabled: row.enabled,
        acceptance: acceptanceOf(row.acceptance),
        staleAfterSeconds: row.staleAfterSeconds,
      };
    });
  }

  override async saveSettings(settings: QrTableSettings): Promise<void> {
    await this.inTenant(settings.tenantId, async (tx) => {
      await tx
        .delete(qrTableSettings)
        .where(eq(qrTableSettings.venueId, settings.venueId));
      await tx.insert(qrTableSettings).values(settings);
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE orders_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
