import { randomUUID } from "node:crypto";

import { BoldPaymentGateway } from "@blackhole/cash-register/adapters/bold/bold-payment-gateway";
import type { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import {
  ApplyQrPayment,
  ConfirmQrPayment,
  PaymentGateway,
  QrInvoiceIssuer,
  QrPaymentAvailability,
  QrPaymentRepository,
  type StartCharge,
  StartQrPayment,
  type StoredQrPayment,
  type VerifiedWebhook,
  type WebhookRequest,
} from "@blackhole/cash-register/application/entry-port";
import type { QrPayment } from "@blackhole/cash-register/domain";
import type { Clock } from "@blackhole/platform/application/ports/clock";
import type { Secrets } from "@blackhole/platform/application/ports/secrets";
import type { OrdersAccount } from "#src/composition/orders-account.js";
import {
  QrTableAccess,
  type QrTableContext,
} from "#src/http/qr-payment.controller.js";

export class ClosedQrTableAccess extends QrTableAccess {
  override async resolve(): Promise<QrTableContext | null> {
    return null;
  }
}

class EmptySplits {
  async find(): Promise<null> {
    return null;
  }

  async save(): Promise<void> {}
}

export class MemoryQrPayments extends QrPaymentRepository {
  private readonly rows = new Map<string, StoredQrPayment>();

  override async findByReference(
    _tenantId: string,
    _venueId: string,
    reference: string,
  ): Promise<StoredQrPayment | null> {
    return this.rows.get(reference) ?? null;
  }

  override async listStarted(): Promise<readonly QrPayment[]> {
    return [...this.rows.values()].filter(
      (payment): payment is QrPayment => payment.status === "started",
    );
  }

  override async listByStatus(
    _tenantId: string,
    _venueId: string,
    status: StoredQrPayment["status"],
  ): Promise<readonly StoredQrPayment[]> {
    return [...this.rows.values()].filter(
      (payment) => payment.status === status,
    );
  }

  override async save(
    _tenantId: string,
    _venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    this.rows.set(payment.reference, payment);
  }

  override async putStarted(
    _tenantId: string,
    _venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    this.rows.set(payment.reference, payment);
  }
}

export class ClosedQrGateway extends PaymentGateway {
  override async startCharge(
    input: StartCharge,
  ): Promise<{ reference: string; redirectUrl: string }> {
    return {
      reference: input.reference,
      redirectUrl: `https://checkout.bold.co/pay/${input.reference}?amount=${input.amountCop}`,
    };
  }

  override async verifyWebhook(
    _input: WebhookRequest,
  ): Promise<VerifiedWebhook | null> {
    return null;
  }

  override async report(): Promise<readonly []> {
    return [];
  }
}

const BOLD_WEBHOOK_SECRET = "bold.webhook-secret";
const BOLD_CHECKOUT_ORIGIN = "https://checkout.bold.co";

export const qrGatewayFor = async (
  secrets: Secrets,
): Promise<PaymentGateway> => {
  try {
    const secret = (await secrets.read(BOLD_WEBHOOK_SECRET)).trim();

    if (secret.length === 0) {
      return new ClosedQrGateway();
    }

    return new BoldPaymentGateway({
      secret,
      checkoutOrigin: BOLD_CHECKOUT_ORIGIN,
      reports: {
        fetchReport: () => Promise.resolve([]),
      },
    });
  } catch {
    return new ClosedQrGateway();
  }
};

class DisabledQrPayments extends QrPaymentAvailability {
  override async enabled(): Promise<boolean> {
    return false;
  }
}

class PendingQrIssuer extends QrInvoiceIssuer {
  override async execute(): Promise<{ document: { status: string } }> {
    return { document: { status: "pending_issuance" } };
  }
}

export const startQrPaymentFor = (
  accounts: OrdersAccount,
  clock: Clock,
  payments: QrPaymentRepository,
  gateway: PaymentGateway,
): StartQrPayment =>
  new StartQrPayment(
    accounts,
    new EmptySplits(),
    payments,
    gateway,
    new DisabledQrPayments(),
    () => `qrpay_${randomUUID()}`,
    clock,
  );

export const confirmQrPaymentFor = (
  payments: QrPaymentRepository,
  gateway: PaymentGateway,
): ConfirmQrPayment => new ConfirmQrPayment(payments, gateway);

export const applyQrPaymentFor = (
  payments: QrPaymentRepository,
  registers: InMemoryCashRegisterRepository,
  accounts: OrdersAccount,
): ApplyQrPayment =>
  new ApplyQrPayment(payments, registers, new PendingQrIssuer(), accounts);
