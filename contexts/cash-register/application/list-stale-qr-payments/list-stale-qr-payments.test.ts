import { expect, it } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ListStaleQrPayments } from "#application/list-stale-qr-payments/list-stale-qr-payments.js";
import { QrPayment } from "#domain/qr-payment.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "orders_check_1";
const NOW = 1_700_000_900_000;
const STALE_AFTER_MS = 900_000;

const pending = (reference: string, startedAt: number, checkId = CHECK_ID) => {
  const payment = QrPayment.start({
    reference,
    checkId,
    partId: null,
    balanceCop: 85_000,
    tipCop: 0,
    startedAt,
  }).confirm({
    reference,
    amountCop: 85_000,
    instrument: "nequi",
  });
  payment.markPendingApplication();

  return payment;
};

it("given pending payments, when stale payments are listed, then only those older than 900s are returned", async () => {
  const payments = new InMemoryQrPaymentRepository();
  const stale = pending("qrpay_stale", NOW - STALE_AFTER_MS - 1);
  const fresh = pending("qrpay_fresh", NOW - STALE_AFTER_MS, "orders_check_2");
  const applied = pending(
    "qrpay_applied",
    NOW - STALE_AFTER_MS - 1,
    "orders_check_3",
  );
  applied.markApplied();
  const started = QrPayment.start({
    reference: "qrpay_started",
    checkId: "orders_check_4",
    partId: null,
    balanceCop: 10_000,
    tipCop: 0,
    startedAt: NOW - STALE_AFTER_MS - 1,
  });
  await payments.save(TENANT_ID, VENUE_ID, stale);
  await payments.save(TENANT_ID, VENUE_ID, fresh);
  await payments.save(TENANT_ID, VENUE_ID, applied);
  await payments.putStarted(TENANT_ID, VENUE_ID, started);
  const list = new ListStaleQrPayments(payments, { now: () => NOW });

  const found = await list.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
  });

  expect(found.map((payment) => payment.reference)).toEqual(["qrpay_stale"]);
  expect(found[0]?.status).toBe("pending_application");
});
