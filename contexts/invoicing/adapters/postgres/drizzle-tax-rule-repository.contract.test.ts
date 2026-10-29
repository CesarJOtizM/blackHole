import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleTaxRuleRepository } from "#adapters/postgres/drizzle-tax-rule-repository.js";
import { taxRuleRepositoryContract } from "#application/ports/tax-rule-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0009_tax.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";

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

taxRuleRepositoryContract(async () => {
  const client = await open();

  return new DrizzleTaxRuleRepository(client);
});

it("given tax rules for tenants A and B, when invoicing_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO tax_rules (
      tenant_id, id, version, position, name, tax_classification,
      regime, vat_responsible, inc_responsible, franchise, channel,
      valid_from, valid_to, fixed_cop, marker, taxes, rut_responsibilities
    ) VALUES
      (
        '${TENANT_A}', 'tax_rule_a', 1, 1, 'independent-restaurant',
        'restaurant service', 'ordinary', false, true, false, 'dine-in',
        '2026-01-01', NULL, NULL, NULL, '[]'::jsonb, '[]'::jsonb
      ),
      (
        '${TENANT_B}', 'tax_rule_b', 1, 1, 'independent-restaurant',
        'restaurant service', NULL, NULL, NULL, NULL, NULL,
        '2026-01-01', NULL, NULL, NULL, '[]'::jsonb, '[]'::jsonb
      )
  `);
  await client.exec("SET ROLE invoicing_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM tax_rules",
  );

  expect(selected.rows.map((row) => row.id)).toEqual(["tax_rule_a"]);
});

it("given a stored tax rule, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO tax_rules (
      tenant_id, id, version, position, name, tax_classification,
      regime, vat_responsible, inc_responsible, franchise, channel,
      valid_from, valid_to, fixed_cop, marker, taxes, rut_responsibilities
    ) VALUES (
      '${TENANT_A}', 'tax_rule_owner', 1, 1, 'independent-restaurant',
      'restaurant service', 'ordinary', false, true, false, 'dine-in',
      '2026-01-01', NULL, 66, 'is_excluded',
      '[{"code":"04","rate":"0.08"}]'::jsonb, '["O-47"]'::jsonb
    )
  `);

  await expect(
    client.exec("UPDATE tax_rules SET fixed_cop = 100"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM tax_rules")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE tax_rules")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ id: string; fixed_cop: number }>(
    "SELECT id, fixed_cop FROM tax_rules",
  );
  expect(selected.rows).toEqual([{ id: "tax_rule_owner", fixed_cop: 66 }]);
});

it("given the tax migration, when row security is read, then it is enabled and forced for invoicing_app", () => {
  const sql = migration.toLowerCase();

  expect(sql).toContain("create role invoicing_app");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain("grant select, insert");
  expect(sql).not.toContain("grant select, insert, update, delete");
  expect(sql).not.toMatch(/000[1-8]_/);
});
