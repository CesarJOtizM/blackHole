import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll } from "vitest";

import { DrizzlePurchasingRepository } from "#adapters/postgres/drizzle-purchasing-repository.js";
import { DrizzleStockLedgerRepository } from "#adapters/postgres/drizzle-stock-ledger-repository.js";
import { purchasingRepositoryContract } from "#application/ports/purchasing-repository.contract.js";
import {
  CONSUMPTION_ROLE,
  type LedgerLine,
} from "#application/ports/stock-ledger-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

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

const TENANT_A = "organization_tenant_a";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const OCCURRED_AT = "2026-06-01T12:00:00.000Z";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const seedLine = (quantity: number): LedgerLine => ({
  id: "movement_seed",
  tenantId: TENANT_A,
  venueId: "venue_site",
  locationId: LOCATION_ID,
  ingredientId: TOMATO_ID,
  quantity,
  unitCost: 1,
  type: MOVEMENT_TYPE.SALE_RETURN,
  reference: "line_seed",
  occurredAt: OCCURRED_AT,
  orderLineId: "line_seed",
  role: CONSUMPTION_ROLE.REVERSAL,
  recipeVersion: 1,
  reason: null,
  actorId: null,
});

purchasingRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(purchasingMigration);
  const purchasing = new DrizzlePurchasingRepository(client);
  const ledger = new DrizzleStockLedgerRepository(client);

  return {
    purchasing,
    balance: (tenantId, locationId, ingredientId) =>
      ledger.balance(tenantId, locationId, ingredientId),
    averageCost: (tenantId, locationId, ingredientId) =>
      purchasing.averageCost(tenantId, locationId, ingredientId),
    movements: (tenantId) => purchasing.purchaseMovements(tenantId),
    receipts: (tenantId) => purchasing.storedReceipts(tenantId),
    outboxCount: async (tenantId) => (await ledger.queued(tenantId)).length,
    failOnInsert: (ordinal) => {
      purchasing.failOnInsert(ordinal);
    },
    seedOnHand: (quantity) =>
      ledger.append({
        movements: [seedLine(quantity)],
        alerts: [],
      }),
  };
});
