import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleShortageRepository } from "#adapters/postgres/drizzle-shortage-repository.js";
import { shortageRepositoryContract } from "#application/ports/shortage-repository.contract.js";

const catalogMigration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const ledgerMigration = readFileSync(
  fileURLToPath(new URL("./0002_stock_ledger.sql", import.meta.url)),
  "utf8",
);
const productionMigration = readFileSync(
  fileURLToPath(new URL("./0006_production.sql", import.meta.url)),
  "utf8",
);
const wasteAndCountsMigration = readFileSync(
  fileURLToPath(new URL("./0008_waste_and_counts.sql", import.meta.url)),
  "utf8",
);
const shortageMigration = readFileSync(
  fileURLToPath(new URL("./0009_shortage_alerts.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(productionMigration);
  await client.exec(wasteAndCountsMigration);
  await client.exec(shortageMigration);
};

shortageRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  const repository = new DrizzleShortageRepository(client);

  return {
    repository,
    inTransaction: (tenantId, work) => repository.inTransaction(tenantId, work),
  };
});

it("given the shortage migration, when the database is still empty, then the shortage tables exist, alerts stay off, and nothing was backfilled", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'stock_level_templates',
        'stock_levels',
        'dish_levels',
        'coverage_settings',
        'notification_rules',
        'shortage_alerts',
        'role_notices',
        'suggested_stock_levels',
        'count_sessions',
        'count_session_lines',
        'ingredient_classifications'
      )
    ORDER BY table_name
  `);
  const outputQuantity = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'output_quantity'
    ORDER BY table_name
  `);
  const flagDefault = await client.query<{ column_default: string | null }>(`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_rules'
      AND column_name = 'shortage_alerts_enabled'
  `);
  const alerts = await client.query<{ count: number | string }>(
    "SELECT count(*) AS count FROM shortage_alerts",
  );
  const movements = await client.query<{ count: number | string }>(
    "SELECT count(*) AS count FROM stock_movements",
  );

  expect(tables.rows.map((row) => row.table_name)).toEqual([
    "count_session_lines",
    "count_sessions",
    "coverage_settings",
    "dish_levels",
    "ingredient_classifications",
    "notification_rules",
    "role_notices",
    "shortage_alerts",
    "stock_level_templates",
    "stock_levels",
    "suggested_stock_levels",
  ]);
  expect(outputQuantity.rows.map((row) => row.table_name)).toEqual([
    "recipe_versions",
    "recipes",
  ]);
  expect(flagDefault.rows[0]?.column_default).toBe("false");
  expect(Number(alerts.rows[0]?.count)).toBe(0);
  expect(Number(movements.rows[0]?.count)).toBe(0);
});
