import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { clockEntries } from "#adapters/postgres/schema.js";
import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ClockEntryRow = typeof clockEntries.$inferSelect;

const toEntry = (row: ClockEntryRow): ClockEntry => ({
  id: row.id,
  tenantId: row.tenantId,
  venueId: row.venueId,
  userId: row.userId,
  deviceId: row.deviceId,
  kind: row.kind as ClockEntry["kind"],
  presence: row.presence as ClockEntry["presence"],
  occurredAt: row.occurredAt,
  commandId: row.commandId,
  cashRegisterId: row.cashRegisterId,
  pendingReview: row.pendingReview,
});

export class DrizzleClockEntryRepository extends ClockEntryRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async append(entry: ClockEntry): Promise<void> {
    await this.inTenant(entry.tenantId, async (tx) => {
      await tx
        .insert(clockEntries)
        .values({
          id: entry.id,
          tenantId: entry.tenantId,
          venueId: entry.venueId,
          userId: entry.userId,
          deviceId: entry.deviceId,
          kind: entry.kind,
          presence: entry.presence,
          occurredAt: entry.occurredAt,
          commandId: entry.commandId,
          cashRegisterId: entry.cashRegisterId,
          pendingReview: entry.pendingReview,
        })
        .onConflictDoNothing({
          target: [clockEntries.tenantId, clockEntries.commandId],
        });
    });
  }

  override async list(query: ListClockEntries): Promise<readonly ClockEntry[]> {
    return this.inTenant(query.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(clockEntries)
        .where(
          and(
            eq(clockEntries.venueId, query.venueId),
            eq(clockEntries.userId, query.userId),
          ),
        );

      return rows.map(toEntry);
    });
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(clockEntries)
        .where(eq(clockEntries.venueId, venueId));

      return rows.map(toEntry);
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE attendance_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
