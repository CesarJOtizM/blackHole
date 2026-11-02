import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { salesDocuments } from "#adapters/postgres/schema.js";
import {
  SALES_DOCUMENT_DUPLICATE,
  SalesDocumentRepository,
  type StoredSalesDocument,
} from "#application/ports/sales-document-repository.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type SalesDocumentRow = typeof salesDocuments.$inferSelect;

const cloneStored = (stored: StoredSalesDocument): StoredSalesDocument =>
  structuredClone(stored);

const isClosureConflict = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };
    const message = record.message ?? "";
    const closureKey =
      record.code === "23505" &&
      (message.includes("sales_documents_pkey") ||
        message.includes("closure_id"));

    if (closureKey) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const issuanceOf = (
  row: SalesDocumentRow,
): { number: string; cufe: string; qr: string } | undefined => {
  if (row.invoiceNumber === null || row.cufe === null || row.qr === null) {
    return undefined;
  }

  return {
    number: row.invoiceNumber,
    cufe: row.cufe,
    qr: row.qr,
  };
};

const toStored = (row: SalesDocumentRow): StoredSalesDocument => {
  const issuance = issuanceOf(row);

  return cloneStored({
    document: {
      closureId: row.closureId,
      referenceCode: row.referenceCode,
      status: row.status,
      buyer: row.buyer,
      ...(issuance ?? {}),
    },
    reason: row.holdReason ?? null,
    content: row.content,
  });
};

export class DrizzleSalesDocumentRepository extends SalesDocumentRepository {
  private readonly database: Database;

  constructor(
    client: PGlite,
    private readonly tenantId: string,
  ) {
    super();
    this.database = drizzle({ client });
  }

  override async findByClosureId(
    closureId: string,
  ): Promise<StoredSalesDocument | null> {
    return this.inTenant(async (tx) => {
      const rows = await tx
        .select()
        .from(salesDocuments)
        .where(eq(salesDocuments.closureId, closureId))
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      if (row.tenantId !== this.tenantId) {
        throw new Error("Stored sales document does not match the tenant.");
      }

      return toStored(row);
    });
  }

  override async insert(stored: StoredSalesDocument): Promise<void> {
    await this.inTenant(async (tx) => {
      const existing = await tx
        .select({ closureId: salesDocuments.closureId })
        .from(salesDocuments)
        .where(eq(salesDocuments.closureId, stored.document.closureId))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(SALES_DOCUMENT_DUPLICATE);
      }

      const copy = cloneStored(stored);

      try {
        await tx.insert(salesDocuments).values({
          tenantId: this.tenantId,
          closureId: copy.document.closureId,
          referenceCode: copy.document.referenceCode,
          status: copy.document.status,
          holdReason: copy.reason,
          buyer: copy.document.buyer,
          content: copy.content,
          invoiceNumber: copy.document.number ?? null,
          cufe: copy.document.cufe ?? null,
          qr: copy.document.qr ?? null,
        });
      } catch (error: unknown) {
        if (isClosureConflict(error)) {
          throw new Error(SALES_DOCUMENT_DUPLICATE);
        }

        throw error;
      }
    });
  }

  private async inTenant<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE invoicing_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${this.tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
