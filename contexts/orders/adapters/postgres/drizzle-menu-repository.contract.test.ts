import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleMenuRepository } from "#adapters/postgres/drizzle-menu-repository.js";
import { menuRepositoryContract } from "#application/ports/menu-repository.contract.js";

const migration = ["0001_menu.sql", "0008_low_units_threshold.sql"]
  .map((name) =>
    readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8"),
  )
  .join("\n");

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

menuRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);

  return new DrizzleMenuRepository(client);
});

it("given menus for tenants A and B, when orders_app selects menus without a tenant filter, then only tenant A returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO menus (id, tenant_id, brand_id)
    VALUES
      ('menu_brand_a', 'organization_tenant_a', 'organization_brand_a'),
      ('menu_brand_b', 'organization_tenant_b', 'organization_brand_b')
  `);
  await client.exec("SET ROLE orders_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_tenant_a",
  ]);

  const selected = await client.query<{ id: string }>("SELECT id FROM menus");

  expect(selected.rows.map((row) => row.id)).toEqual(["menu_brand_a"]);
});
