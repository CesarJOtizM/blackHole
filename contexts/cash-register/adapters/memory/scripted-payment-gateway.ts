import type {
  ChargeRedirect,
  GatewayReportQuery,
  GatewayReportRow,
  StartCharge,
  VerifiedWebhook,
  WebhookRequest,
} from "#application/ports/payment-gateway.js";
import { PaymentGateway } from "#application/ports/payment-gateway.js";

export class ScriptedPaymentGateway extends PaymentGateway {
  readonly charges: StartCharge[] = [];

  verified: VerifiedWebhook | null = null;

  reportRows: readonly GatewayReportRow[] = [];

  override async startCharge(input: StartCharge): Promise<ChargeRedirect> {
    this.charges.push({
      reference: input.reference,
      amountCop: input.amountCop,
    });

    return {
      reference: input.reference,
      redirectUrl: `https://pay.test/${input.reference}`,
    };
  }

  override async verifyWebhook(
    _input: WebhookRequest,
  ): Promise<VerifiedWebhook | null> {
    return this.verified;
  }

  override async report(
    _input: GatewayReportQuery,
  ): Promise<readonly GatewayReportRow[]> {
    return this.reportRows;
  }
}
