import { expect, it } from "vitest";
import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { InMemoryQrOrderIntentRepository } from "#adapters/memory/in-memory-qr-order-intent-repository.js";
import { InMemoryVenueDirectory } from "#adapters/memory/in-memory-venue-directory.js";
import { Clock } from "#application/ports/clock.js";
import {
  QrProductUnavailable,
  RecordQrOrderIntent,
} from "#application/record-qr-order-intent/record-qr-order-intent.js";
import { Menu } from "#domain/menu.js";
import { QR_INTENT_NONE, QrIntentForbidden } from "#domain/qr-order-intent.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_5";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const CHEESE_ID = "menu_modifier_extra_cheese";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOW;
  }
}

const line = {
  productId: SOUP_ID,
  variantIds: [] as string[],
  modifierIds: [CHEESE_ID],
  note: "no onion",
};

const command = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  id: "intent_1",
  lines: [line],
};

const openMenu = (available: boolean): Menu => {
  const menu = Menu.open({
    id: MENU_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });
  menu.publishProduct({
    id: SOUP_ID,
    name: "Soup",
    price: 12_000,
    taxClassification: "restaurant service",
    modifiers: [{ id: CHEESE_ID, name: "Cheese", price: 3_000 }],
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: SOUP_ID,
    price: 22_000,
    available,
  });

  return menu;
};

const harness = async (menu: Menu) => {
  const intents = new InMemoryQrOrderIntentRepository();
  const menus = new InMemoryMenuRepository();
  await menus.save(menu);
  const venues = new InMemoryVenueDirectory({
    [`${TENANT_ID}:${VENUE_ID}`]: BRAND_ID,
  });
  const record = new RecordQrOrderIntent(
    intents,
    menus,
    venues,
    new FixedClock(),
  );

  return { intents, menu, record };
};

it("given the same intent id twice, when both are recorded, then one row keeps the Menu.viewAt price", async () => {
  const menu = openMenu(true);
  const { intents, record } = await harness(menu);
  const view = menu.viewAt({ venueId: VENUE_ID, minute: "12:03" });
  const product = view.products.find((item) => item.id === SOUP_ID);
  const modifier = product?.modifiers.find((item) => item.id === CHEESE_ID);

  const first = await record.execute(command);
  const second = await record.execute(command);

  expect(first).not.toBe(QR_INTENT_NONE);
  expect(second).toEqual(first);
  expect(await intents.list(TENANT_ID, VENUE_ID)).toHaveLength(1);

  if (
    first === QR_INTENT_NONE ||
    product === undefined ||
    modifier === undefined
  ) {
    return;
  }

  expect(first.lines).toHaveLength(1);
  expect(first.lines[0]?.unitPrice).toBe(product.price + modifier.price);
  expect(first.lines[0]?.unitPrice).toBe(25_000);
  expect(first.status).toBe("pending_acceptance");
});

it("given no lines, when the customer submits, then no intent is stored", async () => {
  const { intents, record } = await harness(openMenu(true));

  const stored = await record.execute({ ...command, lines: [] });

  expect(stored).toBe(QR_INTENT_NONE);
  expect(await intents.list(TENANT_ID, VENUE_ID)).toEqual([]);
});

it("given a price, void, discount, or courtesy, when the intent is recorded, then it is rejected and nothing is stored", async () => {
  const { intents, record } = await harness(openMenu(true));

  await expect(record.execute({ ...command, price: 1 })).rejects.toThrow(
    QrIntentForbidden,
  );
  await expect(record.execute({ ...command, void: true })).rejects.toThrow(
    QrIntentForbidden,
  );
  await expect(record.execute({ ...command, discount: 1 })).rejects.toThrow(
    QrIntentForbidden,
  );
  await expect(record.execute({ ...command, courtesy: true })).rejects.toThrow(
    QrIntentForbidden,
  );
  expect(await intents.list(TENANT_ID, VENUE_ID)).toEqual([]);
});

it("given a sold-out dish, when the intent is recorded, then the row is blocked", async () => {
  const { intents, record } = await harness(openMenu(false));

  await expect(record.execute(command)).rejects.toThrow(QrProductUnavailable);
  expect(await intents.list(TENANT_ID, VENUE_ID)).toEqual([]);
});
