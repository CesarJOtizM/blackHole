import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vitest";

import {
  DrizzlePointOfSaleDirectory,
  DrizzleStockLedgerRepository,
} from "#adapters/sqlite/drizzle-stock-ledger-repository.js";
import { stockBalances, stockMovements } from "#adapters/sqlite/schema.js";
import { stockLedgerRepositoryContract } from "#application/ports/stock-ledger-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0002_stock_ledger.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const LOCATION_A = "location_point_of_sale_a";
const LOCATION_B = "location_point_of_sale_b";

const clients: DatabaseSync[] = [];

afterAll(() => {
  for (const client of clients) {
    client.close();
  }
});

const openRepository = (): DrizzleStockLedgerRepository => {
  const client = new DatabaseSync(":memory:");
  clients.push(client);
  client.exec(migration);

  return new DrizzleStockLedgerRepository(client);
};

stockLedgerRepositoryContract(() => {
  const repository = openRepository();

  return {
    repository,
    failOnInsert: (ordinal) => {
      repository.failOnInsert(ordinal);
    },
    queued: (tenantId) => repository.queued(tenantId),
  };
});

it("given a point-of-sale location for each tenant, when tenant A reads the venue, then tenant B stays hidden", async () => {
  const client = new DatabaseSync(":memory:");
  clients.push(client);
  client.exec(migration);
  const directory = new DrizzlePointOfSaleDirectory(client);

  await directory.remember(TENANT_A, VENUE_ID, LOCATION_A);
  await directory.remember(TENANT_B, VENUE_ID, LOCATION_B);

  expect(await directory.locationOf(TENANT_A, VENUE_ID)).toBe(LOCATION_A);
  expect(await directory.locationOf(TENANT_B, VENUE_ID)).toBe(LOCATION_B);
});

it("given the sqlite stock columns, when they are compared with purchasing, then sale columns are nullable and average cost defaults to 0", () => {
  expect(stockMovements.orderLineId.notNull).toBe(false);
  expect(stockMovements.role.notNull).toBe(false);
  expect(stockMovements.recipeVersion.notNull).toBe(false);
  expect(stockBalances.averageCost.notNull).toBe(true);
  expect(stockBalances.averageCost.default).toBe(0);
});
