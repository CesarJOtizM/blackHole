import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import { InMemoryStockLedgerRepository } from "#adapters/memory/in-memory-stock-ledger-repository.js";
import { purchasingRepositoryContract } from "#application/ports/purchasing-repository.contract.js";
import {
  CONSUMPTION_ROLE,
  type LedgerLine,
} from "#application/ports/stock-ledger-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const OCCURRED_AT = "2026-06-01T12:00:00.000Z";

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

purchasingRepositoryContract(() => {
  const ledger = new InMemoryStockLedgerRepository();
  const purchasing = new InMemoryPurchasingRepository(ledger);

  return {
    purchasing,
    balance: (tenantId, locationId, ingredientId) =>
      ledger.balance(tenantId, locationId, ingredientId),
    averageCost: async (tenantId, locationId, ingredientId) =>
      purchasing.averageCost(tenantId, locationId, ingredientId),
    movements: async (tenantId) => purchasing.purchaseMovements(tenantId),
    receipts: async (tenantId) => purchasing.storedReceipts(tenantId),
    outboxCount: async (tenantId) => (await ledger.queued(tenantId)).length,
    failOnInsert: (ordinal) => {
      purchasing.failOnInsert(ordinal);
    },
    seedOnHand: async (quantity) => {
      await ledger.append({
        movements: [seedLine(quantity)],
        alerts: [],
      });
    },
  };
});
