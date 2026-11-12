import { createHmac } from "node:crypto";
import { expect, it } from "vitest";

import { BoldPaymentGateway } from "#adapters/bold/bold-payment-gateway.js";
import type {
  GatewayReportQuery,
  GatewayReportRow,
} from "#application/ports/payment-gateway.js";

const SECRET = "bold-webhook-secret";
const CHECKOUT_ORIGIN = "https://checkout.bold.co";
const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const REFERENCE = "qrpay_table_1";
const AMOUNT_COP = 93_500;

const signatureFor = (rawBody: string): string =>
  createHmac("sha256", SECRET).update(rawBody).digest("hex");

class ScriptedBoldReport {
  rows: readonly GatewayReportRow[] = [];

  queries: GatewayReportQuery[] = [];

  fetchReport(input: GatewayReportQuery): Promise<readonly GatewayReportRow[]> {
    this.queries.push(input);

    return Promise.resolve(this.rows);
  }
}

const gatewayFor = (reports = new ScriptedBoldReport()) =>
  new BoldPaymentGateway({
    secret: SECRET,
    checkoutOrigin: CHECKOUT_ORIGIN,
    reports,
  });

it("given a forged signature, when the webhook is verified, then it is null and the signed body is not a payment", async () => {
  const gateway = gatewayFor();
  const rawBody = JSON.stringify({
    reference: REFERENCE,
    amountCop: AMOUNT_COP,
    instrument: "nequi",
  });

  expect(
    await gateway.verifyWebhook({ rawBody, signature: "forged" }),
  ).toBeNull();
  expect(
    await gateway.verifyWebhook({
      rawBody,
      signature: signatureFor(rawBody),
    }),
  ).toEqual({
    reference: REFERENCE,
    amountCop: AMOUNT_COP,
    instrument: "nequi",
  });
});

it("given a qrpay charge, when the charge starts, then the redirect carries the reference and the amount", async () => {
  const gateway = gatewayFor();

  const redirect = await gateway.startCharge({
    reference: REFERENCE,
    amountCop: AMOUNT_COP,
  });

  expect(redirect).toEqual({
    reference: REFERENCE,
    redirectUrl: `${CHECKOUT_ORIGIN}/pay/${REFERENCE}?amount=${AMOUNT_COP}`,
  });
});

it("given the gateway report lists two references, when the report is read, then those rows are returned", async () => {
  const reports = new ScriptedBoldReport();
  reports.rows = [
    { reference: "qrpay_match", amountCop: 120_000 },
    { reference: "qrpay_tip", amountCop: 8_500 },
  ];
  const gateway = gatewayFor(reports);

  const rows = await gateway.report({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
  });

  expect(reports.queries).toEqual([{ tenantId: TENANT_ID, venueId: VENUE_ID }]);
  expect(rows).toEqual(reports.rows);
});
