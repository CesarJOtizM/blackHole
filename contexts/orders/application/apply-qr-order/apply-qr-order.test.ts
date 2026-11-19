import { expect, it } from "vitest";
import { InMemoryDiningRoomRepository } from "#adapters/memory/in-memory-dining-room-repository.js";
import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { InMemoryPrinter } from "#adapters/memory/in-memory-printer.js";
import { InMemoryQrOrderIntentRepository } from "#adapters/memory/in-memory-qr-order-intent-repository.js";
import { InMemoryRealtimeHub } from "#adapters/memory/in-memory-realtime-hub.js";
import { InMemoryTableQrRepository } from "#adapters/memory/in-memory-table-qr-repository.js";
import { InMemoryVenueDirectory } from "#adapters/memory/in-memory-venue-directory.js";
import { ApplyQrOrder } from "#application/apply-qr-order/apply-qr-order.js";
import { Clock } from "#application/ports/clock.js";
import type { StoredQrOrderIntent } from "#application/ports/qr-order-intent-repository.js";
import { StationDirectory } from "#application/ports/station-directory.js";
import { TakeOrder } from "#application/take-order/take-order.js";
import { Check } from "#domain/check.js";
import { DiningTable } from "#domain/dining-table.js";
import { Menu } from "#domain/menu.js";
import { StationRouter } from "#domain/station-router.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_3";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const STEAK_ID = "menu_product_steak";
const RIBS_ID = "menu_product_ribs";
const INTENT_ID = "intent_1";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOW;
  }
}

class MemoryStations extends StationDirectory {
  private readonly routers = new Map<string, StationRouter>();

  override async load(
    tenantId: string,
    venueId: string,
  ): Promise<StationRouter | null> {
    return this.routers.get(`${tenantId}:${venueId}`) ?? null;
  }

  remember(router: StationRouter): void {
    this.routers.set(`${TENANT_ID}:${router.venueId}`, router);
  }
}

const soupMenu = (): Menu => {
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
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: SOUP_ID,
    price: 22_000,
    available: true,
  });
  menu.publishProduct({
    id: STEAK_ID,
    name: "Steak",
    price: 45_000,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: STEAK_ID,
    price: 45_000,
    available: false,
  });
  menu.publishProduct({
    id: RIBS_ID,
    name: "Ribs",
    price: 32_000,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: RIBS_ID,
    price: 32_000,
    available: true,
  });

  return menu;
};

const intent = (): StoredQrOrderIntent => ({
  id: INTENT_ID,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  status: "pending_acceptance",
  lines: [
    {
      productId: SOUP_ID,
      name: "Soup",
      variantIds: [],
      modifierIds: [],
      unitPrice: 22_000,
    },
  ],
  unavailableProductIds: [],
  sentLineIds: [],
  checkId: null,
  createdAt: new Date(NOW).toISOString(),
});

const harness = async (notRestocked?: {
  execute(input: {
    tenantId: string;
    venueId: string;
    productId: string;
    at: Date;
  }): Promise<boolean>;
}) => {
  const dining = new InMemoryDiningRoomRepository();
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "terrace",
  });
  await dining.save(table);
  const menus = new InMemoryMenuRepository();
  await menus.save(soupMenu());
  const venues = new InMemoryVenueDirectory({
    [`${TENANT_ID}:${VENUE_ID}`]: BRAND_ID,
  });
  const stations = new MemoryStations();
  const router = StationRouter.open({ venueId: VENUE_ID });
  router.assign({
    stationId: "station_grill",
    stationName: "Grill",
    productId: SOUP_ID,
    output: "both",
  });
  router.assign({
    stationId: "station_grill",
    stationName: "Grill",
    productId: RIBS_ID,
    output: "both",
  });
  stations.remember(router);
  const printer = new InMemoryPrinter();
  const clock = new FixedClock();
  const takeOrder = new TakeOrder(
    dining,
    menus,
    stations,
    printer,
    clock,
    new InMemoryRealtimeHub(),
  );
  const intents = new InMemoryQrOrderIntentRepository();
  const tokens = new InMemoryTableQrRepository();
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled: true,
    acceptance: "direct",
    staleAfterSeconds: 900,
  });
  await intents.insert(intent());
  const apply = new ApplyQrOrder(
    intents,
    dining,
    tokens,
    menus,
    venues,
    takeOrder,
    clock,
    notRestocked,
  );

  return { dining, printer, apply, intents };
};

it("given a free table in direct mode, when a QR order is applied, then it opens for one diner and sends once", async () => {
  const { dining, printer, apply } = await harness();

  const first = await apply.execute({
    tenantId: TENANT_ID,
    intentId: INTENT_ID,
  });
  const second = await apply.execute({
    tenantId: TENANT_ID,
    intentId: INTENT_ID,
  });

  const table = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);
  const check =
    first.checkId === null
      ? null
      : await dining.loadCheck(TENANT_ID, VENUE_ID, first.checkId);

  expect(table?.state).toBe("occupied");
  expect(table?.diners).toBe(1);
  expect(first.status).toBe("applied");
  expect(first.lineIds).toEqual(["line_intent_1_0"]);
  expect(second).toEqual(first);
  expect(check?.orders).toEqual([
    expect.objectContaining({
      channel: "qr_table",
      lines: [
        expect.objectContaining({
          id: "line_intent_1_0",
          state: "sent",
          price: 22_000,
        }),
      ],
    }),
  ]);
  expect(printer.jobs).toHaveLength(1);
  expect(printer.jobs[0]).toMatchObject({ channel: "qr_table" });
});

it("given an open account, when a QR order arrives, then its lines join that account", async () => {
  const { dining, apply } = await harness();
  const table = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);

  if (table === null) {
    throw new Error("Expected the table.");
  }

  table.open({ diners: 4 });
  await dining.save(table);
  const open = Check.open({
    id: "check_open",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: new Date(NOW).toISOString(),
  });
  open.addLine({
    orderId: "order_waiter",
    lineId: "line_bread",
    productId: "menu_product_bread",
    name: "Bread",
    course: 1,
    price: 4_000,
    channel: "waiter",
  });
  await dining.saveCheck(open);

  const applied = await apply.execute({
    tenantId: TENANT_ID,
    intentId: INTENT_ID,
  });

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_open");
  const seated = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);

  expect(applied.checkId).toBe("check_open");
  expect(applied.status).toBe("applied");
  expect(seated?.diners).toBe(4);
  expect(stored?.orders.map((order) => order.channel)).toEqual([
    "waiter",
    "qr_table",
  ]);
});

it("given a table waiting to be cleaned, when a QR order arrives, then it is rejected", async () => {
  const { dining, apply } = await harness();
  const table = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);

  if (table === null) {
    throw new Error("Expected the table.");
  }

  table.open({ diners: 2 });
  table.release();
  await dining.save(table);

  const applied = await apply.execute({
    tenantId: TENANT_ID,
    intentId: INTENT_ID,
  });
  const seated = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);

  expect(applied.status).toBe("rejected");
  expect(applied.checkId).toBeNull();
  expect(applied.lineIds).toEqual([]);
  expect(seated?.state).toBe("to_clean");
  expect(seated?.diners).toBe(2);
});

it("given a sold-out dish beside an available one, when the order is applied twice, then the sold-out line is reported once", async () => {
  const { dining, printer, apply, intents } = await harness();
  const stored = intent();
  stored.id = "intent_2";
  stored.lines = [
    ...stored.lines,
    {
      productId: STEAK_ID,
      name: "Steak",
      variantIds: [],
      modifierIds: [],
      unitPrice: 45_000,
    },
  ];
  await intents.insert(stored);

  const first = await apply.execute({
    tenantId: TENANT_ID,
    intentId: "intent_2",
  });
  const second = await apply.execute({
    tenantId: TENANT_ID,
    intentId: "intent_2",
  });
  const check =
    first.checkId === null
      ? null
      : await dining.loadCheck(TENANT_ID, VENUE_ID, first.checkId);

  expect(first.status).toBe("applied");
  expect(first.unavailableProductIds).toEqual([STEAK_ID]);
  expect(first.lineIds).toEqual(["line_intent_2_0"]);
  expect(second).toEqual(first);
  expect(check?.orders.flatMap((order) => order.lines)).toHaveLength(1);
  expect(printer.jobs).toHaveLength(1);
});

it("given ribs marked beside an available soup, when a QR order is applied, then ribs are rejected and soup is sent", async () => {
  const { dining, apply, intents } = await harness({
    execute: (input) => Promise.resolve(input.productId === RIBS_ID),
  });
  const stored = intent();
  stored.id = "intent_ribs";
  stored.lines = [
    {
      productId: SOUP_ID,
      name: "Soup",
      variantIds: [],
      modifierIds: [],
      unitPrice: 22_000,
    },
    {
      productId: RIBS_ID,
      name: "Ribs",
      variantIds: [],
      modifierIds: [],
      unitPrice: 32_000,
    },
  ];
  await intents.insert(stored);

  const applied = await apply.execute({
    tenantId: TENANT_ID,
    intentId: "intent_ribs",
  });
  const check =
    applied.checkId === null
      ? null
      : await dining.loadCheck(TENANT_ID, VENUE_ID, applied.checkId);

  expect(applied.status).toBe("applied");
  expect(applied.unavailableProductIds).toEqual([RIBS_ID]);
  expect(applied.lineIds).toEqual(["line_intent_ribs_0"]);
  expect(check?.orders.flatMap((order) => order.lines)).toEqual([
    expect.objectContaining({
      id: "line_intent_ribs_0",
      productId: SOUP_ID,
      state: "sent",
    }),
  ]);
});
