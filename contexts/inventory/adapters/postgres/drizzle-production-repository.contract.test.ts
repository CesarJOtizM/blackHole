import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleProductionRepository } from "#adapters/postgres/drizzle-production-repository.js";
import { productionRepositoryContract } from "#application/ports/production-repository.contract.js";

const catalogMigration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const ledgerMigration = readFileSync(
  fileURLToPath(new URL("./0002_stock_ledger.sql", import.meta.url)),
  "utf8",
);
const purchasingMigration = readFileSync(
  fileURLToPath(new URL("./0003_purchasing.sql", import.meta.url)),
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

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(purchasingMigration);
  await client.exec(productionMigration);
};

productionRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  const production = new DrizzleProductionRepository(client);

  return {
    production,
    movements: (tenantId) => production.productionMovements(tenantId),
    outboxCount: (tenantId) => production.outboxCount(tenantId),
    failOnInsert: (ordinal) => {
      production.failOnInsert(ordinal);
    },
    seedHolding: (input) => production.seedHolding(input),
  };
});

it("given the production migration, when the database is still empty, then the three tables and output quantity exist and no movement was backfilled", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'production_runs',
        'production_cost_policies',
        'preparation_standard_costs'
      )
    ORDER BY table_name
  `);
  const columns = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'output_quantity'
    ORDER BY table_name
  `);
  const movements = await client.query<{ count: number | string }>(
    "SELECT count(*) AS count FROM stock_movements",
  );

  expect(tables.rows.map((row) => row.table_name)).toEqual([
    "preparation_standard_costs",
    "production_cost_policies",
    "production_runs",
  ]);
  expect(columns.rows.map((row) => row.table_name)).toEqual([
    "recipe_versions",
    "recipes",
  ]);
  expect(Number(movements.rows[0]?.count)).toBe(0);
});
