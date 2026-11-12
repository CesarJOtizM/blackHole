import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { qrPayments } from "#adapters/postgres/schema.js";
import type { StoredQrPayment } from "#application/ports/qr-payment-repository.js";
import { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import { QrPayment, type QrPaymentStatus } from "#domain/qr-payment.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QrPaymentRow = typeof qrPayments.$inferSelect;

export class DuplicateQrReference extends Error {
  constructor() {
    super("A qr_payments reference is already stored.");
    this.name = "DuplicateQrReference";
  }
}

const duplicateReference = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };

    if (
      record.code === "23505" ||
      (typeof record.message === "string" &&
        record.message.includes("qr_payments"))
    ) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const toPayment = (row: QrPaymentRow): StoredQrPayment => {
  const started = QrPayment.start({
    reference: row.reference,
    checkId: row.checkId,
    partId: row.partId,
    balanceCop: row.balanceCop,
    tipCop: row.tipCop,
    startedAt: row.startedAt,
  });

  if (row.status === "started") {
    return started;
  }

  if (row.instrument === null) {
    throw new Error("A confirmed QR payment is missing its instrument.");
  }

  const confirmed = started.confirm({
    reference: row.reference,
    amountCop: row.amountCop,
    instrument: row.instrument,
  });

  if (row.status === "pending_application") {
    confirmed.markPendingApplication();
  }

  if (row.status === "applied") {
    confirmed.markApplied();
  }

  return confirmed;
};

const rowValues = (
  tenantId: string,
  venueId: string,
  payment: StoredQrPayment,
) => ({
  tenantId,
  reference: payment.reference,
  venueId,
  checkId: payment.checkId,
  partId: payment.partId,
  balanceCop: payment.balanceCop,
  tipCop: payment.tipCop,
  amountCop: payment.amountCop,
  instrument: payment.status === "started" ? null : payment.instrument,
  status: payment.status,
  startedAt: payment.startedAt,
  voided: false,
});

export class DrizzleQrPaymentRepository extends QrPaymentRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async findByReference(
    tenantId: string,
    venueId: string,
    reference: string,
  ): Promise<StoredQrPayment | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(qrPayments)
        .where(
          and(
            eq(qrPayments.venueId, venueId),
            eq(qrPayments.reference, reference),
            eq(qrPayments.voided, false),
          ),
        )
        .limit(1);
      const row = rows[0];

      return row === undefined ? null : toPayment(row);
    });
  }

  override async listStarted(
    tenantId: string,
    venueId: string,
  ): Promise<readonly QrPayment[]> {
    const rows = await this.listByStatus(tenantId, venueId, "started");

    return rows.filter(
      (payment): payment is QrPayment => payment.status === "started",
    );
  }

  override async listByStatus(
    tenantId: string,
    venueId: string,
    status: QrPaymentStatus,
  ): Promise<readonly StoredQrPayment[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(qrPayments)
        .where(
          and(
            eq(qrPayments.venueId, venueId),
            eq(qrPayments.status, status),
            eq(qrPayments.voided, false),
          ),
        )
        .orderBy(asc(qrPayments.reference));

      return rows.map((row) => toPayment(row));
    });
  }

  override async save(
    tenantId: string,
    venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      const existing = await tx
        .select({ voided: qrPayments.voided })
        .from(qrPayments)
        .where(
          and(
            eq(qrPayments.venueId, venueId),
            eq(qrPayments.reference, payment.reference),
          ),
        )
        .limit(1);
      const row = existing[0];

      if (row?.voided) {
        return;
      }

      if (row) {
        await tx
          .update(qrPayments)
          .set({
            status: payment.status,
            instrument:
              payment.status === "started" ? null : payment.instrument,
          })
          .where(
            and(
              eq(qrPayments.venueId, venueId),
              eq(qrPayments.reference, payment.reference),
            ),
          );

        return;
      }

      await this.insert(tx, tenantId, venueId, payment);
    });
  }

  override async putStarted(
    tenantId: string,
    venueId: string,
    payment: QrPayment,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      await tx
        .update(qrPayments)
        .set({ voided: true })
        .where(
          and(
            eq(qrPayments.venueId, venueId),
            eq(qrPayments.checkId, payment.checkId),
            payment.partId === null
              ? isNull(qrPayments.partId)
              : eq(qrPayments.partId, payment.partId),
            eq(qrPayments.status, "started"),
            eq(qrPayments.voided, false),
            ne(qrPayments.reference, payment.reference),
          ),
        );
      await this.insert(tx, tenantId, venueId, payment);
    });
  }

  private async insert(
    tx: Transaction,
    tenantId: string,
    venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    try {
      await tx.insert(qrPayments).values(rowValues(tenantId, venueId, payment));
    } catch (error: unknown) {
      if (duplicateReference(error)) {
        throw new DuplicateQrReference();
      }

      throw error;
    }
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE cash_register_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
