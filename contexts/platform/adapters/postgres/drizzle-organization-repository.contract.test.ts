import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleOrganizationRepository } from "#adapters/postgres/drizzle-organization-repository.js";
import { organizationRepositoryContract } from "#application/ports/organization-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0002_organization.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

organizationRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);

  return new DrizzleOrganizationRepository(client);
});

it("given companies A and B, when organization_app selects venues without a tenant filter, then only the current tenant returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO venues (
      id,
      tenant_id,
      company_id,
      name,
      brand_id,
      invoicing_taxpayer_id,
      mode,
      position
    )
    VALUES
      (
        'organization_venue_a',
        'organization_company_a',
        'organization_company_a',
        'North',
        'organization_brand_a',
        'organization_taxpayer_a',
        'cloud',
        0
      ),
      (
        'organization_venue_b',
        'organization_company_b',
        'organization_company_b',
        'South',
        'organization_brand_b',
        'organization_taxpayer_b',
        'cloud',
        1
      )
  `);
  await client.exec("SET ROLE organization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  const selected = await client.query<{ id: string }>("SELECT id FROM venues");

  expect(selected.rows.map((row) => row.id)).toEqual(["organization_venue_a"]);
});
