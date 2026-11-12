import type {
  QrPaymentRepository,
  StoredQrPayment,
} from "#application/ports/qr-payment-repository.js";

const STALE_AFTER_MS = 900_000;

export interface QrPaymentClock {
  now(): number;
}

export interface ListStaleQrPaymentsInput {
  tenantId: string;
  venueId: string;
  olderThanMs?: number;
}

export class ListStaleQrPayments {
  constructor(
    private readonly payments: QrPaymentRepository,
    private readonly clock: QrPaymentClock,
  ) {}

  async execute(
    input: ListStaleQrPaymentsInput,
  ): Promise<readonly StoredQrPayment[]> {
    const olderThanMs = input.olderThanMs ?? STALE_AFTER_MS;
    const now = this.clock.now();
    const pending = await this.payments.listByStatus(
      input.tenantId,
      input.venueId,
      "pending_application",
    );

    return pending.filter((payment) => now - payment.startedAt > olderThanMs);
  }
}
