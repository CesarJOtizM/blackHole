import { expect, it } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import { ReconcileQrPayments } from "#application/reconcile-qr-payments/reconcile-qr-payments.js";
import { QrPayment } from "#domain/qr-payment.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "orders_check_1";
const STARTED_AT = 1_700_000_000_000;

const confirmed = (reference: string, amountCop: number) =>
  QrPayment.start({
    reference,
    checkId: CHECK_ID,
    partId: null,
    balanceCop: amountCop,
    tipCop: 0,
    startedAt: STARTED_AT,
  }).confirm({
    reference,
    amountCop,
    instrument: "card",
  });

it("given confirmed payments matching the gateway report, when reconciliation runs, then no difference appears", async () => {
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const matched = confirmed("qrpay_match", 120_000);
  await payments.save(TENANT_ID, VENUE_ID, matched);
  gateway.reportRows = [{ reference: "qrpay_match", amountCop: 120_000 }];
  const reconcile = new ReconcileQrPayments(payments, gateway);

  const differences = await reconcile.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
  });

  expect(differences).toEqual([]);
});

it("given a confirmed payment missing from the gateway report, when reconciliation runs, then that reference is flagged", async () => {
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const missing = confirmed("qrpay_missing", 85_000);
  const started = QrPayment.start({
    reference: "qrpay_started",
    checkId: CHECK_ID,
    partId: "orders_part_1",
    balanceCop: 10_000,
    tipCop: 0,
    startedAt: STARTED_AT,
  });
  await payments.save(TENANT_ID, VENUE_ID, missing);
  await payments.putStarted(TENANT_ID, VENUE_ID, started);
  gateway.reportRows = [{ reference: "qrpay_other", amountCop: 85_000 }];
  const reconcile = new ReconcileQrPayments(payments, gateway);

  const differences = await reconcile.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
  });

  expect(differences).toEqual([
    {
      reference: "qrpay_missing",
      kind: "missing_in_report",
      recordedCop: 85_000,
      reportedCop: null,
    },
  ]);
});
