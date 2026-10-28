import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleFiscalProfileRepository } from "#adapters/postgres/drizzle-fiscal-profile-repository.js";
import { fiscalProfileRepositoryContract } from "#application/ports/fiscal-profile-repository.contract.js";

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

fiscalProfileRepositoryContract(async () => {
  const client = await open();

  return new DrizzleFiscalProfileRepository(client);
});

it("given adopted profiles for tenants A and B, when invoicing_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO adopted_fiscal_profiles (
      tenant_id, id, taxpayer_id, template_id, profile, rules
    ) VALUES
      (
        '${TENANT_A}', 'tax_profile_a', 'taxpayer_a', 'tax_template_simple_inc',
        '{}'::jsonb, '[]'::jsonb
      ),
      (
        '${TENANT_B}', 'tax_profile_b', 'taxpayer_b', 'tax_template_simple_inc',
        '{}'::jsonb, '[]'::jsonb
      )
  `);
  await client.exec("SET ROLE invoicing_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM adopted_fiscal_profiles",
  );

  expect(selected.rows.map((row) => row.id)).toEqual(["tax_profile_a"]);
});

it("given a stored fiscal template, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO fiscal_templates (id, name, profile, rules)
    VALUES (
      'tax_template_simple_inc',
      'SIMPLE regime, INC responsible',
      '{}'::jsonb,
      '[]'::jsonb
    )
  `);

  await expect(
    client.exec("UPDATE fiscal_templates SET name = 'edited template'"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM fiscal_templates")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE fiscal_templates")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ name: string }>(
    "SELECT name FROM fiscal_templates",
  );
  expect(selected.rows).toEqual([{ name: "SIMPLE regime, INC responsible" }]);
});

it("given a stored adopted profile, when the table owner deletes or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO adopted_fiscal_profiles (
      tenant_id, id, taxpayer_id, template_id, profile, rules
    ) VALUES (
      '${TENANT_A}', 'tax_profile_owner', 'taxpayer_a',
      'tax_template_simple_inc', '{}'::jsonb, '[]'::jsonb
    )
  `);

  await expect(
    client.exec("DELETE FROM adopted_fiscal_profiles"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("TRUNCATE adopted_fiscal_profiles")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM adopted_fiscal_profiles",
  );
  expect(selected.rows).toEqual([{ id: "tax_profile_owner" }]);
});
