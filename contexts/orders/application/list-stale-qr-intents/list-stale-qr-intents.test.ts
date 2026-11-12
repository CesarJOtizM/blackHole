import { expect, it } from "vitest";
import { InMemoryQrOrderIntentRepository } from "#adapters/memory/in-memory-qr-order-intent-repository.js";
import { InMemoryTableQrRepository } from "#adapters/memory/in-memory-table-qr-repository.js";
import {
  ListStaleQrIntents,
  STALE_AFTER_SECONDS,
} from "#application/list-stale-qr-intents/list-stale-qr-intents.js";
import { Clock } from "#application/ports/clock.js";
import type { StoredQrOrderIntent } from "#application/ports/qr-order-intent-repository.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_3";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOW;
  }
}

const intent = (
  id: string,
  status: StoredQrOrderIntent["status"],
  ageSeconds: number,
): StoredQrOrderIntent => ({
  id,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  status,
  lines: [
    {
      productId: "menu_product_soup",
      name: "Soup",
      variantIds: [],
      modifierIds: [],
      unitPrice: 22_000,
    },
  ],
  unavailableProductIds: [],
  sentLineIds: [],
  checkId: null,
  createdAt: new Date(NOW - ageSeconds * 1000).toISOString(),
});

it("given pending orders aged 20 and 2 minutes, when stale intents are listed, then only the 20 minute order alerts", async () => {
  const intents = new InMemoryQrOrderIntentRepository();
  await intents.insert(intent("intent_old", "pending_acceptance", 20 * 60));
  await intents.insert(intent("intent_new", "pending_acceptance", 2 * 60));
  await intents.insert(intent("intent_done", "applied", 20 * 60));
  const list = new ListStaleQrIntents(
    intents,
    new InMemoryTableQrRepository(),
    new FixedClock(),
  );

  const stale = await list.execute({ tenantId: TENANT_ID, venueId: VENUE_ID });

  expect(STALE_AFTER_SECONDS).toBe(900);
  expect(stale).toEqual([{ intentId: "intent_old", ageSeconds: 20 * 60 }]);
});
