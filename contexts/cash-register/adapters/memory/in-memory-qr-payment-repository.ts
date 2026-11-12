import type { StoredQrPayment } from "#application/ports/qr-payment-repository.js";
import { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import type { QrPayment, QrPaymentStatus } from "#domain/qr-payment.js";

const scopeKey = (tenantId: string, venueId: string): string =>
  `${tenantId}\u0000${venueId}`;

const chargeKey = (checkId: string, partId: string | null): string =>
  `${checkId}\u0000${partId ?? ""}`;

const referenceKey = (
  tenantId: string,
  venueId: string,
  reference: string,
): string => `${scopeKey(tenantId, venueId)}\u0000${reference}`;

export class InMemoryQrPaymentRepository extends QrPaymentRepository {
  private readonly rows = new Map<string, Map<string, StoredQrPayment>>();

  private readonly voided = new Set<string>();

  private readonly startedByCharge = new Map<string, string>();

  private bucket(
    tenantId: string,
    venueId: string,
  ): Map<string, StoredQrPayment> {
    const key = scopeKey(tenantId, venueId);
    const existing = this.rows.get(key);

    if (existing) {
      return existing;
    }

    const created = new Map<string, StoredQrPayment>();
    this.rows.set(key, created);

    return created;
  }

  override async findByReference(
    tenantId: string,
    venueId: string,
    reference: string,
  ): Promise<StoredQrPayment | null> {
    if (this.voided.has(referenceKey(tenantId, venueId, reference))) {
      return null;
    }

    return this.bucket(tenantId, venueId).get(reference) ?? null;
  }

  override async listStarted(
    tenantId: string,
    venueId: string,
  ): Promise<readonly QrPayment[]> {
    return [...this.bucket(tenantId, venueId).values()].filter(
      (payment): payment is QrPayment => payment.status === "started",
    );
  }

  override async listByStatus(
    tenantId: string,
    venueId: string,
    status: QrPaymentStatus,
  ): Promise<readonly StoredQrPayment[]> {
    return [...this.bucket(tenantId, venueId).values()].filter(
      (payment) => payment.status === status,
    );
  }

  override async save(
    tenantId: string,
    venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    const key = referenceKey(tenantId, venueId, payment.reference);

    if (this.voided.has(key)) {
      return;
    }

    this.bucket(tenantId, venueId).set(payment.reference, payment);

    if (payment.status === "started") {
      return;
    }

    const slot = `${scopeKey(tenantId, venueId)}\u0000${chargeKey(payment.checkId, payment.partId)}`;

    if (this.startedByCharge.get(slot) === payment.reference) {
      this.startedByCharge.delete(slot);
    }
  }

  override async putStarted(
    tenantId: string,
    venueId: string,
    payment: QrPayment,
  ): Promise<void> {
    const scope = scopeKey(tenantId, venueId);
    const slot = `${scope}\u0000${chargeKey(payment.checkId, payment.partId)}`;
    const previous = this.startedByCharge.get(slot);

    if (previous !== undefined && previous !== payment.reference) {
      this.voided.add(referenceKey(tenantId, venueId, previous));
      this.bucket(tenantId, venueId).delete(previous);
    }

    this.bucket(tenantId, venueId).set(payment.reference, payment);
    this.startedByCharge.set(slot, payment.reference);
  }
}
