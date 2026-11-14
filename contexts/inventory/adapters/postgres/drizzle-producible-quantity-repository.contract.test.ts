import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleProducibleQuantityRepository } from "#adapters/postgres/drizzle-producible-quantity-repository.js";
import { stockBalances } from "#adapters/postgres/schema.js";
import { producibleQuantityRepositoryContract } from "#application/ports/producible-quantity-repository.contract.js";

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
const producibleMigration = readFileSync(
  fileURLToPath(new URL("./0005_producible_quantity.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_1";
const TENANT_B = "organization_tenant_2";
const LOCATION_ID = "location_point";
const BEEF_ID = "ingredient_beef";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(purchasingMigration);
  await client.exec(producibleMigration);
};

producibleQuantityRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  const repository = new DrizzleProducibleQuantityRepository(client);

  return {
    repository,
    stockMovements: async (tenantId) => {
      const selected = await client.query<{ tenant_id: string }>(
        "SELECT tenant_id FROM stock_movements WHERE tenant_id = $1",
        [tenantId],
      );

      return selected.rows.map((row) => ({ tenantId: row.tenant_id }));
    },
  };
});

it("given stock balances for two tenants, when inventory_app reads stock_balances with the local tenant, then the other tenant stays hidden and stock_movements stays empty", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  await client.exec(`
    INSERT INTO stock_balances (
      tenant_id,
      location_id,
      ingredient_id,
      quantity
    )
    VALUES
      ('${TENANT_A}', '${LOCATION_ID}', '${BEEF_ID}', 3000),
      ('${TENANT_B}', '${LOCATION_ID}', '${BEEF_ID}', 9)
  `);

  const database = drizzle({ client });
  const rows = await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE inventory_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`,
    );
    const balances = await tx
      .select({ quantity: stockBalances.quantity })
      .from(stockBalances);
    const movements = await tx.execute<{ id: string }>(
      sql`SELECT id FROM stock_movements`,
    );

    return { balances, movements };
  });

  expect(rows.balances.map((row) => row.quantity)).toEqual([3000]);
  const movementRows = Array.isArray(rows.movements)
    ? rows.movements
    : rows.movements.rows;
  expect(movementRows).toEqual([]);
});
