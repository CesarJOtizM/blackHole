import { expect, it } from "vitest";

import {
  InMemoryPointOfSaleDirectory,
  InMemoryStockLedgerRepository,
  InMemoryStockMovementQueue,
} from "#adapters/memory/in-memory-stock-ledger-repository.js";
import { stockLedgerRepositoryContract } from "#application/ports/stock-ledger-repository.contract.js";
import { CONSUMPTION_ROLE } from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  stockMovedEvent,
} from "#application/ports/stock-movement-queue.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

stockLedgerRepositoryContract(() => {
  const repository = new InMemoryStockLedgerRepository();

  return {
    repository,
    failOnInsert: (ordinal) => {
      repository.failOnInsert(ordinal);
    },
    queued: (tenantId) => repository.queued(tenantId),
  };
});

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const LOCATION_A = "location_point_of_sale_a";
const LOCATION_B = "location_point_of_sale_b";

it("given a movement queued by append, when enqueue repeats its key, then one after_sales row remains", async () => {
  const repository = new InMemoryStockLedgerRepository();
  const queue = new InMemoryStockMovementQueue(repository);
  const movement = {
    id: "movement_beef",
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    locationId: LOCATION_A,
    ingredientId: "ingredient_beef",
    quantity: -200_000,
    unitCost: 1_500,
    type: MOVEMENT_TYPE.SALE_CONSUMPTION,
    reference: "line_burger",
    occurredAt: "2026-11-13T18:00:00.000Z",
    orderLineId: "line_burger",
    role: CONSUMPTION_ROLE.CONSUMPTION,
    recipeVersion: 4,
    reason: null,
    actorId: null,
  };

  await repository.append({ movements: [movement], alerts: [] });
  await queue.enqueue({
    lane: STOCK_MOVEMENT_LANE,
    key: movement.id,
    event: stockMovedEvent(movement),
  });

  expect(await repository.queued(TENANT_A)).toEqual([
    {
      lane: STOCK_MOVEMENT_LANE,
      key: movement.id,
      event: stockMovedEvent(movement),
    },
  ]);
});

it("given a point-of-sale location for each tenant, when tenant A reads the venue, then tenant B stays hidden", async () => {
  const directory = new InMemoryPointOfSaleDirectory();

  directory.remember(TENANT_A, VENUE_ID, LOCATION_A);
  directory.remember(TENANT_B, VENUE_ID, LOCATION_B);

  expect(await directory.locationOf(TENANT_A, VENUE_ID)).toBe(LOCATION_A);
  expect(await directory.locationOf(TENANT_B, VENUE_ID)).toBe(LOCATION_B);
});
