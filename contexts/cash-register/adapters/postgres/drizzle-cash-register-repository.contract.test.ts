import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleCashRegisterRepository } from "#adapters/postgres/drizzle-cash-register-repository.js";
import { cashRegisterRepositoryContract } from "#application/ports/cash-register-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0010_cash_register.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";

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

cashRegisterRepositoryContract(async () => {
  const client = await open();

  return new DrizzleCashRegisterRepository(client);
});

it("given shifts, movements, and payments for tenants A and B, when cash_register_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO cash_shifts (
      tenant_id, id, venue_id, register_id, cashier_id, opening_float_cop, status
    ) VALUES
      (
        '${TENANT_A}', 'shift_a', '${VENUE_ID}', 'organization_register_front',
        'user_cashier', 200000, 'open'
      ),
      (
        '${TENANT_B}', 'shift_b', '${VENUE_ID}', 'organization_register_front',
        'user_other', 50000, 'open'
      );

    INSERT INTO cash_movements (
      tenant_id, id, shift_id, position, kind, amount_cop, reason
    ) VALUES
      (
        '${TENANT_A}', 'movement_a', 'shift_a', 1, 'withdrawal', 300000, 'Safe drop'
      ),
      (
        '${TENANT_B}', 'movement_b', 'shift_b', 1, 'cash_in', 1000, 'Change fund'
      );

    INSERT INTO payments (
      tenant_id, id, venue_id, shift_id, sale_cop, change_cop, tenders, tip
    ) VALUES
      (
        '${TENANT_A}', 'payment_a', '${VENUE_ID}', 'shift_a', 85000, 5000,
        '[]'::jsonb, '{"method":"cash","amountCop":0}'::jsonb
      ),
      (
        '${TENANT_B}', 'payment_b', '${VENUE_ID}', 'shift_b', 10000, 0,
        '[]'::jsonb, '{"method":"cash","amountCop":0}'::jsonb
      )
  `);
  await client.exec("SET ROLE cash_register_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const shifts = await client.query<{ id: string }>(
    "SELECT id FROM cash_shifts",
  );
  const movements = await client.query<{ id: string }>(
    "SELECT id FROM cash_movements",
  );
  const payments = await client.query<{ id: string }>(
    "SELECT id FROM payments",
  );

  expect(shifts.rows.map((row) => row.id)).toEqual(["shift_a"]);
  expect(movements.rows.map((row) => row.id)).toEqual(["movement_a"]);
  expect(payments.rows.map((row) => row.id)).toEqual(["payment_a"]);
});

it("given a stored movement, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO cash_movements (
      tenant_id, id, shift_id, position, kind, amount_cop, reason
    ) VALUES (
      '${TENANT_A}', 'movement_owner', 'shift_front_1', 1, 'withdrawal',
      300000, 'Safe drop'
    )
  `);

  await expect(
    client.exec("UPDATE cash_movements SET amount_cop = 1"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM cash_movements")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE cash_movements")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ id: string; amount_cop: number }>(
    "SELECT id, amount_cop FROM cash_movements",
  );
  expect(selected.rows).toEqual([{ id: "movement_owner", amount_cop: 300000 }]);
});

it("given a stored payment, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO payments (
      tenant_id, id, venue_id, shift_id, sale_cop, change_cop, tenders, tip
    ) VALUES (
      '${TENANT_A}', 'payment_owner', '${VENUE_ID}', 'shift_front_1',
      85000, 5000, '[]'::jsonb, '{"method":"cash","amountCop":0}'::jsonb
    )
  `);

  await expect(client.exec("UPDATE payments SET sale_cop = 1")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("DELETE FROM payments")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE payments")).rejects.toThrow(/append-only/);

  const selected = await client.query<{ id: string; sale_cop: number }>(
    "SELECT id, sale_cop FROM payments",
  );
  expect(selected.rows).toEqual([{ id: "payment_owner", sale_cop: 85000 }]);
});

it("given an open shift, when the table owner updates only status, then the status changes and any other change is rejected", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO cash_shifts (
      tenant_id, id, venue_id, register_id, cashier_id, opening_float_cop, status
    ) VALUES (
      '${TENANT_A}', 'shift_owner', '${VENUE_ID}', 'organization_register_front',
      'user_cashier', 200000, 'open'
    )
  `);

  await client.exec("UPDATE cash_shifts SET status = 'counting'");
  await expect(
    client.exec("UPDATE cash_shifts SET opening_float_cop = 1"),
  ).rejects.toThrow(/status only/);
  await expect(client.exec("DELETE FROM cash_shifts")).rejects.toThrow(
    /status only/,
  );
  await expect(client.exec("TRUNCATE cash_shifts")).rejects.toThrow(
    /status only/,
  );

  const selected = await client.query<{
    status: string;
    opening_float_cop: number;
  }>("SELECT status, opening_float_cop FROM cash_shifts");
  expect(selected.rows).toEqual([
    { status: "counting", opening_float_cop: 200000 },
  ]);
});

it("given the cash register migration, when row security is read, then it is enabled and forced for cash_register_app", async () => {
  await open();
  const sql = migration.toLowerCase();

  expect(sql).toContain("create role cash_register_app");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain("grant select, insert");
  expect(sql).not.toContain("grant select, insert, update, delete");
  expect(sql).not.toMatch(/000[1-9]_/);
});
