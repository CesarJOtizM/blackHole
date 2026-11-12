import type { AccountGateway } from "#application/ports/account-gateway.js";
import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import type { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import type { PayAccountPartInput } from "#application/split-account/split-account.js";
import {
  type QrInvoiceMethod,
  QrPaymentConfirmed,
  QrPaymentNotConfirmed,
} from "#domain/qr-payment.js";

export interface QrIssueDocumentCommand {
  closureId: string;
  referenceCode: string;
  taxpayerEmail: string;
  documentBalance: number;
  rules: readonly [];
  siteRangeId: string;
  registerRangeId?: string;
}

export abstract class QrInvoiceIssuer {
  abstract execute(
    command: QrIssueDocumentCommand,
  ): Promise<{ document: { status: string } }>;
}

export interface ApplyQrPaymentInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  reference: string;
  taxpayerEmail?: string;
  siteRangeId?: string;
}

export interface AppliedQrPayment {
  reference: string;
  status: "applied" | "pending_application";
  tenderMethod: "qr";
  tipCop: number;
  invoiceMethod: QrInvoiceMethod;
  issuanceStatus: "accepted" | "pending_issuance" | null;
  saleCop: number;
}

const appliedView = (
  payment: QrPaymentConfirmed,
  issuanceStatus: AppliedQrPayment["issuanceStatus"],
): AppliedQrPayment => ({
  reference: payment.reference,
  status:
    payment.status === "pending_application"
      ? "pending_application"
      : "applied",
  tenderMethod: "qr",
  tipCop: payment.tipCop,
  invoiceMethod: payment.invoiceMethod,
  issuanceStatus,
  saleCop: payment.balanceCop,
});

interface AccountPartPayer {
  pay(input: PayAccountPartInput): Promise<{ open: boolean }>;
}

const releaseTable = async (
  accounts: AccountGateway | null,
  splitAccount: AccountPartPayer | null,
  input: ApplyQrPaymentInput,
  payment: QrPaymentConfirmed,
): Promise<void> => {
  if (accounts === null) {
    return;
  }

  if (payment.partId !== null && splitAccount !== null) {
    const split = await splitAccount.pay({
      tenantId: input.tenantId,
      venueId: input.venueId,
      registerId: input.registerId,
      checkId: payment.checkId,
      partId: payment.partId,
    });

    if (!split.open) {
      await accounts.markPaid(input.tenantId, input.venueId, payment.checkId);
    }

    return;
  }

  const check = await accounts.findCheck(
    input.tenantId,
    input.venueId,
    payment.checkId,
  );
  const remaining = (check?.accountCop ?? 0) - payment.balanceCop;

  if (remaining <= 0) {
    await accounts.markPaid(input.tenantId, input.venueId, payment.checkId);
  }
};

export class ApplyQrPayment {
  constructor(
    private readonly payments: QrPaymentRepository,
    private readonly registers: CashRegisterRepository,
    private readonly invoices: QrInvoiceIssuer,
    private readonly accounts: AccountGateway | null = null,
    private readonly splitAccount: AccountPartPayer | null = null,
  ) {}

  async execute(input: ApplyQrPaymentInput): Promise<AppliedQrPayment> {
    const found = await this.payments.findByReference(
      input.tenantId,
      input.venueId,
      input.reference,
    );

    if (!(found instanceof QrPaymentConfirmed)) {
      throw new QrPaymentNotConfirmed();
    }

    if (found.status === "applied") {
      return appliedView(found, "accepted");
    }

    const shift = await this.registers.load(
      input.tenantId,
      input.venueId,
      input.registerId,
    );

    if (shift?.state !== "open") {
      found.markPendingApplication();
      await this.payments.save(input.tenantId, input.venueId, found);

      return appliedView(found, null);
    }

    const paymentId = `payment_${found.reference}`;

    shift.recordPayment({
      id: paymentId,
      originalPaymentId: paymentId,
      method: "qr",
      amountCop: found.balanceCop,
    });
    await this.registers.save(input.tenantId, input.venueId, shift);

    let issuanceStatus: AppliedQrPayment["issuanceStatus"] = "accepted";

    try {
      const issued = await this.invoices.execute({
        closureId: `closure_${found.reference}`,
        referenceCode: found.reference,
        taxpayerEmail: input.taxpayerEmail ?? "",
        documentBalance: found.balanceCop,
        rules: [],
        siteRangeId: input.siteRangeId ?? "site_range_qr",
        registerRangeId: input.registerId,
      });

      if (issued.document.status === "pending_issuance") {
        issuanceStatus = "pending_issuance";
      }
    } catch {
      issuanceStatus = "pending_issuance";
    }

    await releaseTable(this.accounts, this.splitAccount, input, found);
    found.markApplied();
    await this.payments.save(input.tenantId, input.venueId, found);

    return appliedView(found, issuanceStatus);
  }

  async applyPending(input: {
    tenantId: string;
    venueId: string;
    registerId: string;
  }): Promise<void> {
    const pending = await this.payments.listByStatus(
      input.tenantId,
      input.venueId,
      "pending_application",
    );

    for (const payment of pending) {
      await this.execute({
        tenantId: input.tenantId,
        venueId: input.venueId,
        registerId: input.registerId,
        reference: payment.reference,
      });
    }
  }
}
