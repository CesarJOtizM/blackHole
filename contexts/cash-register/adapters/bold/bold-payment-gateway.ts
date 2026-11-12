import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  ChargeRedirect,
  GatewayReportQuery,
  GatewayReportRow,
  StartCharge,
  VerifiedWebhook,
  WebhookRequest,
} from "#application/ports/payment-gateway.js";
import { PaymentGateway } from "#application/ports/payment-gateway.js";
import { InvalidQrReference, type QrInstrument } from "#domain/qr-payment.js";

const REFERENCE_PREFIX = "qrpay_";

const INSTRUMENTS = ["card", "nequi", "daviplata", "bre-b"] as const;

export interface BoldReportClient {
  fetchReport(input: GatewayReportQuery): Promise<readonly GatewayReportRow[]>;
}

export interface BoldPaymentGatewayOptions {
  secret: string;
  checkoutOrigin: string;
  reports: BoldReportClient;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInstrument = (value: string): value is QrInstrument =>
  INSTRUMENTS.some((instrument) => instrument === value);

const isQrReference = (reference: string): boolean =>
  reference.startsWith(REFERENCE_PREFIX) &&
  reference.length > REFERENCE_PREFIX.length;

const readVerified = (rawBody: string): VerifiedWebhook | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const { reference, amountCop, instrument } = parsed;

  if (typeof reference !== "string" || !isQrReference(reference)) {
    return null;
  }

  if (
    typeof amountCop !== "number" ||
    !Number.isInteger(amountCop) ||
    amountCop < 0
  ) {
    return null;
  }

  if (typeof instrument !== "string" || !isInstrument(instrument)) {
    return null;
  }

  return {
    reference,
    amountCop,
    instrument,
  };
};

const signaturesMatch = (expected: string, actual: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

export class BoldPaymentGateway extends PaymentGateway {
  constructor(private readonly options: BoldPaymentGatewayOptions) {
    super();
  }

  override async startCharge(input: StartCharge): Promise<ChargeRedirect> {
    if (!isQrReference(input.reference)) {
      throw new InvalidQrReference();
    }

    const redirectUrl = new URL(
      `/pay/${input.reference}`,
      this.options.checkoutOrigin,
    );
    redirectUrl.searchParams.set("amount", String(input.amountCop));

    return {
      reference: input.reference,
      redirectUrl: redirectUrl.toString(),
    };
  }

  override async verifyWebhook(
    input: WebhookRequest,
  ): Promise<VerifiedWebhook | null> {
    const expected = createHmac("sha256", this.options.secret)
      .update(input.rawBody)
      .digest("hex");

    if (!signaturesMatch(expected, input.signature)) {
      return null;
    }

    return readVerified(input.rawBody);
  }

  override async report(
    input: GatewayReportQuery,
  ): Promise<readonly GatewayReportRow[]> {
    const rows = await this.options.reports.fetchReport(input);

    return rows.map((row) => ({
      reference: row.reference,
      amountCop: row.amountCop,
    }));
  }
}
