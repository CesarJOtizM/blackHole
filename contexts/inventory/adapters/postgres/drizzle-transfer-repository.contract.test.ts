import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll } from "vitest";

import { DrizzleTransferRepository } from "#adapters/postgres/drizzle-transfer-repository.js";
import { transferRepositoryContract } from "#application/ports/transfer-repository.contract.js";

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
const transferMigration = readFileSync(
  fileURLToPath(new URL("./0004_transfers.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

transferRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(purchasingMigration);
  await client.exec(transferMigration);
  const transfers = new DrizzleTransferRepository(client);

  return {
    transfers,
    balance: (tenantId, locationId, ingredientId) =>
      transfers.balance(tenantId, locationId, ingredientId),
    averageCost: (tenantId, locationId, ingredientId) =>
      transfers.averageCost(tenantId, locationId, ingredientId),
    movements: (tenantId) => transfers.movements(tenantId),
    outboxCount: (tenantId) => transfers.outboxCount(tenantId),
    failOnInsert: (ordinal) => {
      transfers.failOnInsert(ordinal);
    },
    seedBalance: (tenantId, locationId, ingredientId, quantity, averageCost) =>
      transfers.seedBalance(
        tenantId,
        locationId,
        ingredientId,
        quantity,
        averageCost,
      ),
  };
});
