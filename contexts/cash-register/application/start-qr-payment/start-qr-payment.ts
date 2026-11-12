import { UnknownAccount } from "#application/charge-check/charge-check.js";
import type { AccountGateway } from "#application/ports/account-gateway.js";
import type { AccountSplitStore } from "#application/ports/account-split-store.js";
import type { PaymentGateway } from "#application/ports/payment-gateway.js";
import type { QrPaymentAvailability } from "#application/ports/qr-payment-availability.js";
import type { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import { QrPayment } from "#domain/qr-payment.js";

export class QrPaymentDisabled extends Error {
  constructor() {
    super("QR payment is disabled.");
    this.name = "QrPaymentDisabled";
  }
}

export interface StartQrPaymentInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  tipCop: number;
  partId?: string;
  amountCop?: number;
}

export interface StartedQrCharge {
  payment: QrPayment;
  redirectUrl: string;
}

export interface QrClock {
  now(): number;
}

const balanceForPart = async (
  splits: AccountSplitStore,
  input: StartQrPaymentInput,
  accountCop: number,
): Promise<number> => {
  if (input.partId === undefined) {
    return accountCop;
  }

  const split = await splits.find(input.tenantId, input.venueId, input.checkId);
  const part = split?.parts.find((candidate) => candidate.id === input.partId);

  if (!part) {
    throw new UnknownAccount();
  }

  return part.amountCop;
};

export class StartQrPayment {
  constructor(
    private readonly accounts: AccountGateway,
    private readonly splits: AccountSplitStore,
    private readonly payments: QrPaymentRepository,
    private readonly gateway: PaymentGateway,
    private readonly availability: QrPaymentAvailability,
    private readonly nextReference: () => string,
    private readonly clock: QrClock,
  ) {}

  async execute(input: StartQrPaymentInput): Promise<StartedQrCharge> {
    const enabled = await this.availability.enabled(
      input.tenantId,
      input.venueId,
    );

    if (!enabled) {
      throw new QrPaymentDisabled();
    }

    const check = await this.accounts.findCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null || check.checkId !== input.checkId) {
      throw new UnknownAccount();
    }

    const payment = QrPayment.start({
      reference: this.nextReference(),
      checkId: input.checkId,
      partId: input.partId ?? null,
      balanceCop: await balanceForPart(this.splits, input, check.accountCop),
      tipCop: input.tipCop,
      startedAt: this.clock.now(),
    });

    await this.payments.putStarted(input.tenantId, input.venueId, payment);
    const redirect = await this.gateway.startCharge({
      reference: payment.reference,
      amountCop: payment.amountCop,
    });

    return {
      payment,
      redirectUrl: redirect.redirectUrl,
    };
  }
}
