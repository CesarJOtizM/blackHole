import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleCashRegisterLedger } from "#adapters/postgres/drizzle-cash-register-ledger.js";
import { LedgerCashFactReader } from "#adapters/postgres/ledger-cash-fact-reader.js";
import type { SaleClosure } from "#application/charge-check/charge-check.js";
import { ListCashFacts } from "#application/list-cash-facts/list-cash-facts.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0010_cash_register.sql", import.meta.url)),
  "utf8",
);
const tipsMigration = readFileSync(
  fileURLToPath(new URL("./0015_tips.sql", import.meta.url)),
  "utf8",
);

const TENANT_ID = "organization_tenant_a";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const CHECK_ID = "orders_check_1";
const SHIFT_ID = "shift_front_1";
const RECORDED_AT = "2026-11-04T18:21:00.000Z";
const FROM = "2026-11-04T05:00:00.000Z";
const TO = "2026-11-05T05:00:00.000Z";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);
  await client.exec(tipsMigration);

  return client;
};

const closure = (): SaleClosure => ({
  id: "closure_check_1",
  status: "queued",
  commandId: "command_charge_1",
  checkId: CHECK_ID,
  tableId: "orders_table_5",
  registerId: REGISTER_ID,
  paymentId: "payment_check_1",
  saleCop: 85_000,
  changeCop: 0,
  lines: [
    {
      lineId: "orders_line_1",
      productId: "menu_product_1",
      priceCop: 85_000,
      originTableId: "orders_table_5",
      menuClass: "food",
    },
  ],
  tenders: [
    { method: "cash", amountCop: 50_000 },
    { method: "qr", amountCop: 35_000 },
  ],
  tip: { method: "cash", amountCop: 5_000 },
});

it("given an empty ledger, when cash facts are read, then every section stays empty", async () => {
  const client = await open();
  const reader = new LedgerCashFactReader(client);
  const facts = await new ListCashFacts(reader).execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    from: FROM,
    to: TO,
  });

  expect(facts).toEqual({
    tenders: [],
    tips: [],
    settlements: [],
    counts: [],
  });
});

it("given ledger payments, a settlement, and a count, when cash facts are read, then chargedAt is recorded_at and qr stays on the reader", async () => {
  const client = await open();
  const ledger = new DrizzleCashRegisterLedger(client);
  const reader = new LedgerCashFactReader(client);

  await ledger.insertClosure({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: closure(),
  });
  await ledger.insertCount({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    id: "count_front",
    countedBy: "user_cashier",
    status: "counting",
    expectedCashCop: 100_000,
    countedCashCop: 97_000,
    denominations: [],
    terminals: [],
  });
  await ledger.insertCount({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    id: "count_blind",
    countedBy: "user_cashier",
    status: "open",
    denominations: [],
    terminals: [],
  });
  await ledger.appendTipSettlement({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    settlement: {
      id: "settlement_day",
      poolCop: 5_000,
      methods: [{ method: "cash", amountCop: 5_000 }],
      participants: [{ userId: "user_waiter", workedMinutes: 480 }],
      shares: [{ userId: "user_waiter", baseCop: 5_000, residueCop: 0 }],
      residueCop: 0,
      rule: { mode: "equal", shares: [] },
      adjustsSettlementId: null,
      edits: [],
    },
  });

  const stored = await reader.listTenders({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    from: FROM,
    to: TO,
  });

  expect(stored.map((row) => row.method)).toEqual(["cash", "qr"]);

  const facts = await new ListCashFacts(reader).execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    from: FROM,
    to: TO,
  });

  expect(facts.tenders).toEqual([
    {
      checkId: CHECK_ID,
      waiterId: null,
      method: "cash",
      amountCop: 50_000,
      tipCop: 5_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.tips).toEqual([
    {
      waiterId: null,
      method: "cash",
      tipCop: 5_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.settlements).toEqual([
    {
      settlementId: "settlement_day",
      poolCop: 5_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.counts).toEqual([
    {
      shiftId: SHIFT_ID,
      method: "cash",
      expectedCop: 100_000,
      countedCop: 97_000,
      differenceCop: -3_000,
      chargedAt: RECORDED_AT,
    },
  ]);
});
