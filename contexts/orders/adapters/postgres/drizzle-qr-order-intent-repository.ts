import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { qrOrderIntents } from "#adapters/postgres/schema.js";
import {
  QrOrderIntentRepository,
  type StoredQrIntentLine,
  type StoredQrOrderIntent,
} from "#application/ports/qr-order-intent-repository.js";
import type { QrIntentStatus } from "#domain/qr-order-intent.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type IntentRow = typeof qrOrderIntents.$inferSelect;

const statusOf = (value: string): QrIntentStatus => {
  if (
    value === "pending_acceptance" ||
    value === "applied" ||
    value === "rejected"
  ) {
    return value;
  }

  throw new Error("Stored QR intent status is not recognized.");
};

const lineOf = (line: StoredQrIntentLine): StoredQrIntentLine => ({
  productId: line.productId,
  name: line.name,
  variantIds: [...line.variantIds],
  modifierIds: [...line.modifierIds],
  ...(line.note === undefined ? {} : { note: line.note }),
  unitPrice: line.unitPrice,
});

const intentOf = (row: IntentRow): StoredQrOrderIntent => ({
  id: row.id,
  tenantId: row.tenantId,
  venueId: row.venueId,
  tableId: row.tableId,
  status: statusOf(row.status),
  lines: row.lines.map(lineOf),
  unavailableProductIds: [...row.unavailableProductIds],
  sentLineIds: [...row.sentLineIds],
  checkId: row.checkId,
  createdAt: row.createdAt,
});

export class DrizzleQrOrderIntentRepository extends QrOrderIntentRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async find(
    tenantId: string,
    intentId: string,
  ): Promise<StoredQrOrderIntent | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(qrOrderIntents)
        .where(eq(qrOrderIntents.id, intentId));
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      if (row.tenantId !== tenantId) {
        throw new Error("Stored QR intent does not match the tenant.");
      }

      return intentOf(row);
    });
  }

  override async insert(intent: StoredQrOrderIntent): Promise<void> {
    await this.inTenant(intent.tenantId, async (tx) => {
      await tx.insert(qrOrderIntents).values({
        ...intent,
        lines: intent.lines.map(lineOf),
        unavailableProductIds: [...intent.unavailableProductIds],
        sentLineIds: [...intent.sentLineIds],
      });
    });
  }

  override async save(intent: StoredQrOrderIntent): Promise<void> {
    await this.inTenant(intent.tenantId, async (tx) => {
      await tx.delete(qrOrderIntents).where(eq(qrOrderIntents.id, intent.id));
      await tx.insert(qrOrderIntents).values({
        ...intent,
        lines: intent.lines.map(lineOf),
        unavailableProductIds: [...intent.unavailableProductIds],
        sentLineIds: [...intent.sentLineIds],
      });
    });
  }

  override async list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StoredQrOrderIntent[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(qrOrderIntents)
        .where(
          and(
            eq(qrOrderIntents.tenantId, tenantId),
            eq(qrOrderIntents.venueId, venueId),
          ),
        );

      return rows.map(intentOf);
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
