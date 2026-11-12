import type { QrInstrument } from "#domain/qr-payment.js";

export interface StartCharge {
  reference: string;
  amountCop: number;
}

export interface ChargeRedirect {
  reference: string;
  redirectUrl: string;
}

export interface VerifiedWebhook {
  reference: string;
  amountCop: number;
  instrument: QrInstrument;
}

export interface WebhookRequest {
  rawBody: string;
  signature: string;
}

export interface GatewayReportQuery {
  tenantId: string;
  venueId: string;
}

export interface GatewayReportRow {
  reference: string;
  amountCop: number;
}

export abstract class PaymentGateway {
  abstract startCharge(input: StartCharge): Promise<ChargeRedirect>;

  abstract verifyWebhook(
    input: WebhookRequest,
  ): Promise<VerifiedWebhook | null>;

  abstract report(
    input: GatewayReportQuery,
  ): Promise<readonly GatewayReportRow[]>;
}
