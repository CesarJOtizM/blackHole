import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleCashRegisterLedger } from "#adapters/postgres/drizzle-cash-register-ledger.js";
import { DrizzleQrPaymentRepository } from "#adapters/postgres/drizzle-qr-payment-repository.js";
import { QrPayment, QrPaymentConfirmed } from "#domain/qr-payment.js";

const readMigration = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_5";
const REGISTER_ID = "organization_register_front";
const REFERENCE = "qrpay_table_1";
const STARTED_AT = 1_700_000_000_000;

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(readMigration("0010_cash_register.sql"));
  await client.exec(readMigration("0015_tips.sql"));
  await client.exec(readMigration("0016_qr_table_payment.sql"));

  return client;
};

const started = (reference: string, checkId = CHECK_ID) =>
  QrPayment.start({
    reference,
    checkId,
    partId: null,
    balanceCop: 85_000,
    tipCop: 8_500,
    startedAt: STARTED_AT,
  });

const closureSql = (
  id: string,
  paymentId: string,
  checkId = CHECK_ID,
): string => `
  INSERT INTO sale_closures (
    tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
    payment_id, status, sale_cop, change_cop, lines, tenders, tip
  ) VALUES (
    '${TENANT_A}', '${id}', '${VENUE_ID}', '${checkId}', '${TABLE_ID}',
    '${REGISTER_ID}', 'command_${id}', '${paymentId}', 'queued',
    85000, 0, '[]'::jsonb,
    '[{"method":"qr","amountCop":85000}]'::jsonb,
    '{"method":"qr","amountCop":0}'::jsonb
  )
`;

it("given tenant A stored a qr reference, when the same reference is stored again, then the duplicate fails and tenant B stays hidden", async () => {
  const repository = new DrizzleQrPaymentRepository(await open());
  const payment = started(REFERENCE);
  await repository.putStarted(TENANT_A, VENUE_ID, payment);
  const confirmed = payment.confirm({
    reference: REFERENCE,
    amountCop: payment.amountCop,
    instrument: "nequi",
  });
  await repository.save(TENANT_A, VENUE_ID, confirmed);

  const visible = await repository.findByReference(
    TENANT_A,
    VENUE_ID,
    REFERENCE,
  );
  const hidden = await repository.findByReference(
    TENANT_B,
    VENUE_ID,
    REFERENCE,
  );
  const listed = await repository.listByStatus(TENANT_B, VENUE_ID, "confirmed");

  expect(visible).toBeInstanceOf(QrPaymentConfirmed);
  expect(visible?.status).toBe("confirmed");
  expect(visible?.amountCop).toBe(93_500);
  expect(hidden).toBeNull();
  expect(listed).toEqual([]);
  await expect(
    repository.putStarted(
      TENANT_A,
      VENUE_ID,
      started(REFERENCE, "orders_check_2"),
    ),
  ).rejects.toThrow(/qr_payments/);
});

it("given one account and two payment ids, when the closures are stored, then both stay and a repeated payment id is rejected", async () => {
  const client = await open();
  await client.exec(closureSql("closure_qr_1", "payment_qr_1"));
  await client.exec(closureSql("closure_qr_2", "payment_qr_2"));

  const stored = await client.query<{ payment_id: string }>(
    `SELECT payment_id FROM sale_closures
     WHERE tenant_id = '${TENANT_A}'
     ORDER BY payment_id`,
  );

  expect(stored.rows.map((row) => row.payment_id)).toEqual([
    "payment_qr_1",
    "payment_qr_2",
  ]);
  await expect(
    client.exec(closureSql("closure_qr_3", "payment_qr_1")),
  ).rejects.toThrow(/sale_closures_one_payment/);
});

it("given a qr tender, when the ledger stores the closure, then the tip method qr is listed", async () => {
  const client = await open();
  const ledger = new DrizzleCashRegisterLedger(client);

  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: "shift_front_1",
    recordedAt: "2026-11-11T18:00:00.000Z",
    closure: {
      id: "closure_qr_tip",
      status: "queued",
      commandId: "command_qr_tip",
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      registerId: REGISTER_ID,
      paymentId: "payment_qr_tip",
      saleCop: 120_000,
      changeCop: 0,
      lines: [],
      tenders: [{ method: "qr", amountCop: 120_000 }],
      tip: { method: "qr", amountCop: 8_500 },
    },
  });

  const tips = await ledger.listPaymentTips(TENANT_A, VENUE_ID);

  expect(tips).toEqual([
    {
      recordedAt: "2026-11-11T18:00:00.000Z",
      saleCop: 120_000,
      taxCop: 0,
      tip: { method: "qr", amountCop: 8_500 },
    },
  ]);
});
