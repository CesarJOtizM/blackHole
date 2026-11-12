import type { PaymentGateway } from "#application/ports/payment-gateway.js";
import type { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import {
  QrPaymentConfirmed,
  QrPaymentNotConfirmed,
} from "#domain/qr-payment.js";

export interface ConfirmQrPaymentInput {
  tenantId: string;
  venueId: string;
  rawBody: string;
  signature: string;
}

export class ConfirmQrPayment {
  constructor(
    private readonly payments: QrPaymentRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(
    input: ConfirmQrPaymentInput,
  ): Promise<QrPaymentConfirmed | null> {
    const verified = await this.gateway.verifyWebhook({
      rawBody: input.rawBody,
      signature: input.signature,
    });

    if (verified === null) {
      return null;
    }

    const existing = await this.payments.findByReference(
      input.tenantId,
      input.venueId,
      verified.reference,
    );

    if (existing === null) {
      return null;
    }

    if (existing instanceof QrPaymentConfirmed) {
      return existing;
    }

    try {
      const confirmed = existing.confirm(verified);
      await this.payments.save(input.tenantId, input.venueId, confirmed);

      return confirmed;
    } catch (error) {
      if (error instanceof QrPaymentNotConfirmed) {
        return null;
      }

      throw error;
    }
  }
}
