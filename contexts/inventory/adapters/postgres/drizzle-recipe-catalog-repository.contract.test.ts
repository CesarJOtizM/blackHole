import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleRecipeCatalogRepository } from "#adapters/postgres/drizzle-recipe-catalog-repository.js";
import { recipeCatalogRepositoryContract } from "#application/ports/recipe-catalog-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const productionMigration = readFileSync(
  fileURLToPath(new URL("./0006_production.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

recipeCatalogRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(productionMigration);

  return new DrizzleRecipeCatalogRepository(client);
});

it("given ingredients for tenants A and B, when inventory_app selects them without a tenant filter, then only tenant A returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO ingredients (
      tenant_id,
      brand_id,
      version,
      id,
      name,
      base_unit,
      reference_cost_cop
    )
    VALUES
      (
        'organization_tenant_a',
        'organization_brand_a',
        1,
        'ingredient_onion',
        'onion',
        'g',
        80
      ),
      (
        'organization_tenant_b',
        'organization_brand_b',
        1,
        'ingredient_cheese',
        'cheese',
        'g',
        90
      )
  `);
  await client.exec("SET ROLE inventory_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_tenant_a",
  ]);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM ingredients",
  );

  expect(selected.rows.map((row) => row.id)).toEqual(["ingredient_onion"]);
});
