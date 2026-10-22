import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleAuthorizationRepository } from "#adapters/postgres/drizzle-authorization-repository.js";
import { authorizationRepositoryContract } from "#application/ports/authorization-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0004_authorization.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

authorizationRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);

  return new DrizzleAuthorizationRepository(client);
});

it("given companies A and B, when authorization_app selects assignments without a tenant filter, then only the current tenant returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO authorization_assignments (
      id,
      tenant_id,
      user_id,
      role_id,
      scope_kind,
      scope_id,
      valid_from,
      valid_until,
      position
    )
    VALUES
      (
        'assignment_a',
        'organization_company_a',
        'user_owner_a',
        'cashier',
        'site',
        'organization_venue_a',
        NULL,
        NULL,
        0
      ),
      (
        'assignment_b',
        'organization_company_b',
        'user_owner_b',
        'cashier',
        'site',
        'organization_venue_b',
        NULL,
        NULL,
        0
      )
  `);
  await client.exec("SET ROLE authorization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  const selected = await client.query<{ user_id: string }>(
    "SELECT user_id FROM authorization_assignments",
  );

  expect(selected.rows.map((row) => row.user_id)).toEqual(["user_owner_a"]);
});

it("given the authorization migration, when its text is read, then it stores no PIN", () => {
  const sql = migration.toLowerCase();

  expect(sql).not.toMatch(/\bpin\b/);
  expect(sql).not.toContain("pin_hash");
});
