import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  type NoRestockMarkQuery,
  NoRestockRepository,
  persistedNoRestockStatus,
  restoreNoRestockToday,
  snapshotNoRestockToday,
} from "#application/ports/no-restock-repository.js";
import type { NoRestockToday } from "#domain/no-restock-today.js";

export const noRestockToday = pgTable(
  "no_restock_today",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    productId: text("product_id").notNull(),
    status: text("status").notNull(),
    actorId: text("actor_id"),
    serviceDate: text("service_date"),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.venueId, table.productId],
    }),
  ],
);

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class DrizzleNoRestockRepository extends NoRestockRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async save(mark: NoRestockToday): Promise<void> {
    const stored = snapshotNoRestockToday(mark);

    await this.inTenant(stored.tenantId, async (tx) => {
      await tx
        .insert(noRestockToday)
        .values(stored)
        .onConflictDoUpdate({
          target: [
            noRestockToday.tenantId,
            noRestockToday.venueId,
            noRestockToday.productId,
          ],
          set: {
            status: stored.status,
            actorId: stored.actorId,
            serviceDate: stored.serviceDate,
          },
        });
    });
  }

  override async find(
    query: NoRestockMarkQuery,
  ): Promise<NoRestockToday | null> {
    return this.inTenant(query.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(noRestockToday)
        .where(
          and(
            eq(noRestockToday.tenantId, query.tenantId),
            eq(noRestockToday.venueId, query.venueId),
            eq(noRestockToday.productId, query.productId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return restoreNoRestockToday({
        tenantId: row.tenantId,
        venueId: row.venueId,
        productId: row.productId,
        status: persistedNoRestockStatus(row.status),
        actorId: row.actorId,
        serviceDate: row.serviceDate,
      });
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
