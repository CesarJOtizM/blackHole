import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleCashRegisterLedger } from "#adapters/postgres/drizzle-cash-register-ledger.js";
import type { SaleClosure } from "#application/charge-check/charge-check.js";
import type { AccountPart } from "#domain/account-split.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0010_cash_register.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const CHECK_ID = "orders_check_1";
const OTHER_CHECK_ID = "orders_check_2";
const TABLE_ID = "orders_table_5";
const ORIGIN_TABLE_ID = "orders_table_joined";
const CASHIER_ID = "user_cashier";
const MENU_CLASS = "food";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);

  return client;
};

const part = (): AccountPart => ({
  id: "part_1",
  amountCop: 33_334,
  originTableId: ORIGIN_TABLE_ID,
  paid: false,
  lines: [
    {
      lineId: "orders_line_1",
      amountCop: 33_334,
      originTableId: ORIGIN_TABLE_ID,
    },
  ],
});

const closure = (): SaleClosure => ({
  id: "closure_check_1",
  status: "queued",
  commandId: "command_charge_1",
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  registerId: REGISTER_ID,
  paymentId: "payment_check_1",
  saleCop: 85_000,
  changeCop: 5_000,
  lines: [
    {
      lineId: "orders_line_1",
      productId: "menu_product_1",
      priceCop: 85_000,
      originTableId: ORIGIN_TABLE_ID,
      menuClass: MENU_CLASS,
    },
  ],
  tenders: [
    {
      method: "card",
      amountCop: 50_000,
      terminal: "terminal_1",
      approvalNumber: "approval_1",
      brand: "visa",
      last4: "4242",
    },
    { method: "cash", amountCop: 40_000 },
  ],
  tip: { method: "cash", amountCop: 0 },
});

it("given parts, counts, and closures for tenants A and B, when cash_register_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO account_parts (
      tenant_id, id, venue_id, check_id, origin_table_id, amount_cop, paid, lines
    ) VALUES
      (
        '${TENANT_A}', 'part_a', '${VENUE_ID}', '${CHECK_ID}',
        '${ORIGIN_TABLE_ID}', 33334, false,
        '[{"lineId":"orders_line_1","amountCop":33334,"originTableId":"${ORIGIN_TABLE_ID}"}]'::jsonb
      ),
      (
        '${TENANT_B}', 'part_b', '${VENUE_ID}', '${CHECK_ID}',
        '${ORIGIN_TABLE_ID}', 33333, false, '[]'::jsonb
      );

    INSERT INTO cash_counts (
      tenant_id, id, venue_id, register_id, counted_by, status,
      expected_cash_cop, counted_cash_cop, denominations, terminals
    ) VALUES
      (
        '${TENANT_A}', 'count_a', '${VENUE_ID}', '${REGISTER_ID}',
        '${CASHIER_ID}', 'open', NULL, NULL, '[]'::jsonb, '[]'::jsonb
      ),
      (
        '${TENANT_B}', 'count_b', '${VENUE_ID}', '${REGISTER_ID}',
        'user_other', 'counting', 100000, 80000, '[]'::jsonb, '[]'::jsonb
      );

    INSERT INTO sale_closures (
      tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
      payment_id, status, sale_cop, change_cop, lines, tenders, tip
    ) VALUES
      (
        '${TENANT_A}', 'closure_a', '${VENUE_ID}', '${CHECK_ID}', '${TABLE_ID}',
        '${REGISTER_ID}', 'command_charge_1', 'payment_check_1', 'queued',
        85000, 5000, '[]'::jsonb, '[]'::jsonb, '{"method":"cash","amountCop":0}'::jsonb
      ),
      (
        '${TENANT_B}', 'closure_b', '${VENUE_ID}', '${CHECK_ID}', '${TABLE_ID}',
        '${REGISTER_ID}', 'command_charge_1', 'payment_check_1', 'queued',
        10000, 0, '[]'::jsonb, '[]'::jsonb, '{"method":"cash","amountCop":0}'::jsonb
      )
  `);
  await client.exec("SET ROLE cash_register_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const parts = await client.query<{ id: string }>(
    "SELECT id FROM account_parts",
  );
  const counts = await client.query<{ id: string }>(
    "SELECT id FROM cash_counts",
  );
  const closures = await client.query<{ id: string }>(
    "SELECT id FROM sale_closures",
  );

  expect(parts.rows.map((row) => row.id)).toEqual(["part_a"]);
  expect(counts.rows.map((row) => row.id)).toEqual(["count_a"]);
  expect(closures.rows.map((row) => row.id)).toEqual(["closure_a"]);
});

it("given a stored part, count, and closure, when the table owner updates, deletes, or truncates them, then each trigger rejects the change and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO account_parts (
      tenant_id, id, venue_id, check_id, origin_table_id, amount_cop, paid, lines
    ) VALUES (
      '${TENANT_A}', 'part_owner', '${VENUE_ID}', '${CHECK_ID}',
      '${ORIGIN_TABLE_ID}', 33334, false, '[]'::jsonb
    );

    INSERT INTO cash_counts (
      tenant_id, id, venue_id, register_id, counted_by, status,
      expected_cash_cop, counted_cash_cop, denominations, terminals
    ) VALUES (
      '${TENANT_A}', 'count_owner', '${VENUE_ID}', '${REGISTER_ID}',
      '${CASHIER_ID}', 'counting', 100000, 80000, '[]'::jsonb, '[]'::jsonb
    );

    INSERT INTO sale_closures (
      tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
      payment_id, status, sale_cop, change_cop, lines, tenders, tip
    ) VALUES (
      '${TENANT_A}', 'closure_owner', '${VENUE_ID}', '${CHECK_ID}',
      '${TABLE_ID}', '${REGISTER_ID}', 'command_charge_1', 'payment_check_1',
      'queued', 85000, 5000, '[]'::jsonb, '[]'::jsonb,
      '{"method":"cash","amountCop":0}'::jsonb
    )
  `);

  for (const statement of [
    "UPDATE account_parts SET amount_cop = 1",
    "DELETE FROM account_parts",
    "TRUNCATE account_parts",
    "UPDATE cash_counts SET counted_cash_cop = 1",
    "DELETE FROM cash_counts",
    "TRUNCATE cash_counts",
    "UPDATE sale_closures SET sale_cop = 1",
    "DELETE FROM sale_closures",
    "TRUNCATE sale_closures",
  ]) {
    await expect(client.exec(statement)).rejects.toThrow(/append-only/);
  }

  const parts = await client.query<{ id: string; amount_cop: number }>(
    "SELECT id, amount_cop FROM account_parts",
  );
  const counts = await client.query<{ id: string; counted_cash_cop: number }>(
    "SELECT id, counted_cash_cop FROM cash_counts",
  );
  const closures = await client.query<{ id: string; sale_cop: number }>(
    "SELECT id, sale_cop FROM sale_closures",
  );

  expect(parts.rows).toEqual([{ id: "part_owner", amount_cop: 33334 }]);
  expect(counts.rows).toEqual([{ id: "count_owner", counted_cash_cop: 80000 }]);
  expect(closures.rows).toEqual([{ id: "closure_owner", sale_cop: 85000 }]);
});

it("given a peso amount, identifier, or closure status outside the rules, when it is inserted, then the check rejects it", async () => {
  const client = await open();
  const partInsert = (id: string, amount: string) => `
    INSERT INTO account_parts (
      tenant_id, id, venue_id, check_id, origin_table_id, amount_cop, paid, lines
    ) VALUES (
      '${TENANT_A}', '${id}', '${VENUE_ID}', '${CHECK_ID}',
      '${ORIGIN_TABLE_ID}', ${amount}, false, '[]'::jsonb
    )
  `;

  await expect(client.exec(partInsert("split_1", "33334"))).rejects.toThrow(
    /account_parts_id_prefix/,
  );
  await expect(client.exec(partInsert("part_1", "-1"))).rejects.toThrow(
    /account_parts_amount_cop/,
  );
  await expect(client.exec(partInsert("part_1", "'1.5'"))).rejects.toThrow(
    /integer/,
  );
  await expect(
    client.exec(`
      INSERT INTO cash_counts (
        tenant_id, id, venue_id, register_id, counted_by, status,
        expected_cash_cop, denominations, terminals
      ) VALUES (
        '${TENANT_A}', 'shift_count', '${VENUE_ID}', '${REGISTER_ID}',
        '${CASHIER_ID}', 'open', NULL, '[]'::jsonb, '[]'::jsonb
      )
    `),
  ).rejects.toThrow(/cash_counts_id_prefix/);
  await expect(
    client.exec(`
      INSERT INTO cash_counts (
        tenant_id, id, venue_id, register_id, counted_by, status,
        expected_cash_cop, denominations, terminals
      ) VALUES (
        '${TENANT_A}', 'count_negative', '${VENUE_ID}', '${REGISTER_ID}',
        '${CASHIER_ID}', 'counting', -1, '[]'::jsonb, '[]'::jsonb
      )
    `),
  ).rejects.toThrow(/cash_counts_expected_cash_cop/);
  await expect(
    client.exec(`
      INSERT INTO sale_closures (
        tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
        payment_id, status, sale_cop, change_cop, lines, tenders, tip
      ) VALUES (
        '${TENANT_A}', 'payment_closure', '${VENUE_ID}', '${CHECK_ID}',
        '${TABLE_ID}', '${REGISTER_ID}', 'command_charge_1', 'payment_check_1',
        'queued', 85000, 5000, '[]'::jsonb, '[]'::jsonb,
        '{"method":"cash","amountCop":0}'::jsonb
      )
    `),
  ).rejects.toThrow(/sale_closures_id_prefix/);
  await expect(
    client.exec(`
      INSERT INTO sale_closures (
        tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
        payment_id, status, sale_cop, change_cop, lines, tenders, tip
      ) VALUES (
        '${TENANT_A}', 'closure_open', '${VENUE_ID}', '${CHECK_ID}',
        '${TABLE_ID}', '${REGISTER_ID}', 'command_charge_1', 'payment_check_1',
        'open', 85000, 5000, '[]'::jsonb, '[]'::jsonb,
        '{"method":"cash","amountCop":0}'::jsonb
      )
    `),
  ).rejects.toThrow(/sale_closures_status/);
  await expect(
    client.exec(`
      INSERT INTO sale_closures (
        tenant_id, id, venue_id, check_id, table_id, register_id, command_id,
        payment_id, status, sale_cop, change_cop, lines, tenders, tip
      ) VALUES (
        '${TENANT_A}', 'closure_negative', '${VENUE_ID}', '${OTHER_CHECK_ID}',
        '${TABLE_ID}', '${REGISTER_ID}', 'command_charge_2', 'payment_check_1',
        'queued', -1, 0, '[]'::jsonb, '[]'::jsonb,
        '{"method":"cash","amountCop":0}'::jsonb
      )
    `),
  ).rejects.toThrow(/sale_closures_sale_cop/);
});

it("given the cash register migration, when parts, counts, and closures are declared, then each has tenant_id, forced row security, and an insert-only grant in 0010", () => {
  const sql = migration.toLowerCase();

  for (const table of ["account_parts", "cash_counts", "sale_closures"]) {
    expect(sql).toContain(`create table ${table}`);
    expect(sql).toContain(`alter table ${table} enable row level security`);
    expect(sql).toContain(`alter table ${table} force row level security`);
  }

  expect(sql).toContain(
    "grant select, insert on account_parts, cash_counts, sale_closures to cash_register_app",
  );
  expect(sql.match(/create role cash_register_app/g)).toHaveLength(1);
  expect(sql).not.toContain("0011_");
});

it("given a part, when it is stored and loaded, then the part_ id and originTableId come back and another tenant sees nothing", async () => {
  const client = await open();
  const ledger = new DrizzleCashRegisterLedger(client);
  const stored = part();

  await ledger.insertPart({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    part: stored,
  });

  expect(await ledger.loadParts(TENANT_A, VENUE_ID, CHECK_ID)).toEqual([
    stored,
  ]);
  expect(await ledger.loadParts(TENANT_B, VENUE_ID, CHECK_ID)).toEqual([]);
});

it("given a count before submit and a submitted count that stores expected cash, when the cashier reads them, then both reads omit expected cash and a correction is a new row", async () => {
  const client = await open();
  const ledger = new DrizzleCashRegisterLedger(client);
  const denominations = [
    { denomination: 50_000 as const, quantity: 1 },
    { denomination: 20_000 as const, quantity: 1 },
    { denomination: 10_000 as const, quantity: 1 },
  ];
  const terminals = [{ terminalId: "terminal_1", differenceCop: 0 }];

  await ledger.insertCount({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    id: "count_blind",
    countedBy: CASHIER_ID,
    status: "open",
    denominations: [],
    terminals: [],
  });

  expect(
    await ledger.readCount(TENANT_A, VENUE_ID, REGISTER_ID, "count_blind"),
  ).toEqual({
    id: "count_blind",
    countedBy: CASHIER_ID,
    status: "open",
    countedCashCop: null,
    denominations: [],
    terminals: [],
  });

  await ledger.insertCount({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    id: "count_submitted",
    countedBy: CASHIER_ID,
    status: "counting",
    expectedCashCop: 100_000,
    countedCashCop: 80_000,
    denominations,
    terminals,
  });

  const submitted = await ledger.readCount(
    TENANT_A,
    VENUE_ID,
    REGISTER_ID,
    "count_submitted",
  );

  expect(submitted).not.toHaveProperty("expectedCashCop");
  expect(submitted).toEqual({
    id: "count_submitted",
    countedBy: CASHIER_ID,
    status: "counting",
    countedCashCop: 80_000,
    denominations,
    terminals,
  });
  expect(
    await ledger.readCount(TENANT_B, VENUE_ID, REGISTER_ID, "count_submitted"),
  ).toBeNull();

  await ledger.insertCount({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    id: "count_correction",
    countedBy: CASHIER_ID,
    status: "closed",
    expectedCashCop: 100_000,
    countedCashCop: 90_000,
    denominations: [],
    terminals: [],
  });

  const correction = await ledger.readCount(
    TENANT_A,
    VENUE_ID,
    REGISTER_ID,
    "count_correction",
  );

  expect(correction).not.toHaveProperty("expectedCashCop");
  expect(correction).toEqual({
    id: "count_correction",
    countedBy: CASHIER_ID,
    status: "closed",
    countedCashCop: 90_000,
    denominations: [],
    terminals: [],
  });

  const stored = await client.query<{
    id: string;
    expected_cash_cop: number | null;
  }>("SELECT id, expected_cash_cop FROM cash_counts ORDER BY id");

  expect(stored.rows).toEqual([
    { id: "count_blind", expected_cash_cop: null },
    { id: "count_correction", expected_cash_cop: 100000 },
    { id: "count_submitted", expected_cash_cop: 100000 },
  ]);
});

it("given one queued closure for a check, when the same closure is inserted again, then the check still has one row and the copied charge stays", async () => {
  const client = await openTips();
  const ledger = new DrizzleCashRegisterLedger(client);
  const queued = closure();

  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: queued,
  });
  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: { ...queued, saleCop: 1 },
  });
  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: {
      ...queued,
      id: "closure_check_2",
      commandId: "command_charge_2",
    },
  });

  expect(await ledger.loadClosure(TENANT_A, VENUE_ID, CHECK_ID)).toEqual(
    queued,
  );
  expect(await ledger.loadClosure(TENANT_B, VENUE_ID, CHECK_ID)).toBeNull();

  const sameCheck = await client.query<{ id: string }>(
    "SELECT id FROM sale_closures ORDER BY id",
  );

  expect(sameCheck.rows).toEqual([{ id: "closure_check_1" }]);

  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: {
      ...queued,
      id: "closure_check_other",
      checkId: OTHER_CHECK_ID,
      commandId: "command_charge_other",
    },
  });

  const bothChecks = await client.query<{ id: string }>(
    "SELECT id FROM sale_closures ORDER BY id",
  );

  expect(bothChecks.rows).toEqual([
    { id: "closure_check_1" },
    { id: "closure_check_other" },
  ]);
});

const EPOCH = "1970-01-01T00:00:00.000Z";
const RECORDED_AT = "2026-11-04T18:21:00.000Z";
const SHIFT_ID = "shift_front_1";
const WAITER_ID = "user_waiter";
const COOK_ID = "user_cook";
const SETTLEMENT_ID = "settlement_day_1";

const tipsMigration = () =>
  readFileSync(
    fileURLToPath(new URL("./0015_tips.sql", import.meta.url)),
    "utf8",
  );

const openTips = async () => {
  const client = await open();
  await client.exec(tipsMigration());

  return client;
};

const settlementRow = () => ({
  id: SETTLEMENT_ID,
  poolCop: 50_000,
  methods: [
    { method: "cash" as const, amountCop: 20_000 },
    { method: "card" as const, amountCop: 30_000 },
  ],
  participants: [
    { userId: WAITER_ID, workedMinutes: 480 },
    { userId: COOK_ID, workedMinutes: 360 },
  ],
  shares: [
    { userId: COOK_ID, baseCop: 25_000, residueCop: 0 },
    { userId: WAITER_ID, baseCop: 25_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: { mode: "equal" as const, shares: [] },
  adjustsSettlementId: null,
  edits: [
    {
      userId: "user_extra",
      workedMinutes: null,
      reason: "Called in sick",
      change: "remove" as const,
    },
  ],
});

it("given a payment stored before tips, when 0015 runs, then recorded_at is the epoch and tax is untouched", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO payments (
      tenant_id, id, venue_id, shift_id, sale_cop, change_cop, tenders, tip
    ) VALUES (
      '${TENANT_A}', 'payment_old', '${VENUE_ID}', '${SHIFT_ID}',
      85000, 5000, '[]'::jsonb, '{"method":"cash","amountCop":20000}'::jsonb
    )
  `);
  const source = tipsMigration();
  await client.exec(source);

  const recorded = await client.query<{ recorded_at: string }>(
    "SELECT recorded_at FROM payments WHERE id = 'payment_old'",
  );
  const columns = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'payments'",
  );
  const lowered = source.toLowerCase();

  expect(recorded.rows).toEqual([{ recorded_at: EPOCH }]);
  await expect(
    client.exec("UPDATE payments SET recorded_at = '2026-11-04T18:21:00.000Z'"),
  ).rejects.toThrow(/append-only/);
  const kept = await client.query<{ recorded_at: string; sale_cop: number }>(
    "SELECT recorded_at, sale_cop FROM payments WHERE id = 'payment_old'",
  );
  expect(kept.rows).toEqual([{ recorded_at: EPOCH, sale_cop: 85000 }]);
  expect(columns.rows.map((row) => row.column_name)).not.toContain("tax_cop");
  expect(lowered).toContain("create table tip_rules");
  expect(lowered).toContain("create table tip_settlements");
  expect(lowered).toContain("1970-01-01t00:00:00.000z");
  expect(lowered).toContain("cash_register_app");
  expect(lowered).not.toContain("create role");
  expect(lowered).not.toContain("tax");
});

it("given tip rules and settlements for two tenants, when cash_register_app selects, then only the current tenant returns and a settlement cannot change", async () => {
  const client = await openTips();
  await client.exec(`
    INSERT INTO tip_rules (tenant_id, venue_id, period, mode, shares) VALUES
      ('${TENANT_A}', '${VENUE_ID}', 'day', 'equal', '[]'::jsonb),
      ('${TENANT_B}', '${VENUE_ID}', 'week', 'hours', '[]'::jsonb);

    INSERT INTO tip_settlements (
      tenant_id, id, venue_id, pool_cop, residue_cop, methods, participants,
      shares, rule, edits, adjusts_settlement_id
    ) VALUES
      (
        '${TENANT_A}', '${SETTLEMENT_ID}', '${VENUE_ID}', 50000, 0,
        '[{"method":"cash","amountCop":20000}]'::jsonb, '[]'::jsonb,
        '[]'::jsonb, '{"mode":"equal","shares":[]}'::jsonb,
        '[{"userId":"user_extra","workedMinutes":null,"reason":"Called in sick","change":"remove"}]'::jsonb,
        NULL
      ),
      (
        '${TENANT_B}', 'settlement_other', '${VENUE_ID}', 1000, 0,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        '{"mode":"hours","shares":[]}'::jsonb, '[]'::jsonb, NULL
      )
  `);
  await client.exec("SET ROLE cash_register_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const rules = await client.query<{ venue_id: string }>(
    "SELECT venue_id FROM tip_rules",
  );
  const settlements = await client.query<{ id: string }>(
    "SELECT id FROM tip_settlements",
  );

  expect(rules.rows).toEqual([{ venue_id: VENUE_ID }]);
  expect(settlements.rows).toEqual([{ id: SETTLEMENT_ID }]);

  await client.exec("RESET ROLE");

  for (const statement of [
    "UPDATE tip_settlements SET pool_cop = 1",
    "DELETE FROM tip_settlements",
    "TRUNCATE tip_settlements",
  ]) {
    await expect(client.exec(statement)).rejects.toThrow(/append-only/);
  }

  const kept = await client.query<{ id: string; pool_cop: number }>(
    `SELECT id, pool_cop FROM tip_settlements WHERE tenant_id = '${TENANT_A}'`,
  );

  expect(kept.rows).toEqual([{ id: SETTLEMENT_ID, pool_cop: 50000 }]);

  await client.exec(
    `UPDATE tip_rules SET mode = 'hours' WHERE tenant_id = '${TENANT_A}'`,
  );
  const replaced = await client.query<{ mode: string }>(
    `SELECT mode FROM tip_rules WHERE tenant_id = '${TENANT_A}'`,
  );

  expect(replaced.rows).toEqual([{ mode: "hours" }]);
});

it("given a closure with a platform timestamp, when it is stored and reloaded, then the payment time, method pool, and edit reason stay", async () => {
  const client = await openTips();
  const ledger = new DrizzleCashRegisterLedger(client);
  const queued = closure();
  const row = settlementRow();
  const rule = {
    period: "day" as const,
    mode: "percentage" as const,
    shares: [
      { employeeId: WAITER_ID, percent: 70 },
      { employeeId: COOK_ID, percent: 30 },
    ],
  };

  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: RECORDED_AT,
    closure: queued,
  });
  await ledger.insertClosure({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    shiftId: SHIFT_ID,
    recordedAt: EPOCH,
    closure: queued,
  });
  await ledger.saveTipRule({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    rule,
  });
  await ledger.appendTipSettlement({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    settlement: row,
  });
  await ledger.appendTipSettlement({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    settlement: {
      ...row,
      poolCop: 1,
      methods: [{ method: "cash", amountCop: 1 }],
      shares: [{ userId: WAITER_ID, baseCop: 1, residueCop: 0 }],
      edits: [
        {
          userId: "user_extra",
          workedMinutes: null,
          reason: "Replaced",
          change: "remove",
        },
      ],
    },
  });

  expect(await ledger.listPaymentTips(TENANT_A, VENUE_ID)).toEqual([
    {
      recordedAt: RECORDED_AT,
      tip: queued.tip,
      saleCop: queued.saleCop,
      taxCop: 0,
    },
  ]);
  expect(await ledger.listPaymentTips(TENANT_B, VENUE_ID)).toEqual([]);
  expect(await ledger.findTipRule(TENANT_A, VENUE_ID)).toEqual(rule);
  expect(await ledger.findTipRule(TENANT_B, VENUE_ID)).toBeNull();
  expect(await ledger.listTipSettlements(TENANT_A, VENUE_ID)).toEqual([row]);
  expect(await ledger.listTipSettlements(TENANT_B, VENUE_ID)).toEqual([]);

  await ledger.saveTipRule({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    rule: { period: "week", mode: "hours", shares: [] },
  });

  expect(await ledger.findTipRule(TENANT_A, VENUE_ID)).toEqual({
    period: "week",
    mode: "hours",
    shares: [],
  });
});
