import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import { InMemoryQrOrderIntentRepository } from "@blackhole/orders/adapters/memory/in-memory-qr-order-intent-repository";
import { InMemoryRealtimeHub } from "@blackhole/orders/adapters/memory/in-memory-realtime-hub";
import { InMemoryTableQrRepository } from "@blackhole/orders/adapters/memory/in-memory-table-qr-repository";
import { InMemoryVenueDirectory } from "@blackhole/orders/adapters/memory/in-memory-venue-directory";
import { Clock } from "@blackhole/orders/application/ports/clock";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import {
  DiningTable,
  Menu,
  StationRouter,
  TableQrToken,
} from "@blackhole/orders/domain";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { expect, it } from "vitest";
import {
  TableQrController,
  tableQrMenuPath,
  tableQrOrderPath,
  tableQrStatusPath,
} from "#src/http/table-qr.controller.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_3";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const NONCE = "table-qr-nonce-0001";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOW;
  }
}

const controllerFor = async (enabled: boolean): Promise<TableQrController> => {
  const tokens = new InMemoryTableQrRepository();
  const issued = TableQrToken.issue({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: NONCE,
  });
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: issued.digest,
    retired: false,
  });
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled,
    acceptance: "direct",
    staleAfterSeconds: 900,
  });
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
  const menus = new InMemoryMenuRepository();
  await menus.save(menu);

  return new TableQrController(
    tokens,
    menus,
    new InMemoryVenueDirectory({ [`${TENANT_ID}:${VENUE_ID}`]: BRAND_ID }),
    new FixedClock(),
  );
};

it("given table QR ordering is disabled, when the customer opens /m/:token, then the portal refuses", async () => {
  const controller = await controllerFor(false);

  expect(tableQrMenuPath).toBe("m/:token");
  expect(tableQrMenuPath).not.toContain("/d/");
  expect(tableQrMenuPath).not.toContain("/f/");
  await expect(controller.readMenu(NONCE)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});

it("given an active table QR, when the customer opens /m/:token, then the site menu is shown", async () => {
  const controller = await controllerFor(true);
  const menu = await controller.readMenu(NONCE);

  expect(menu).toMatchObject({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    products: [expect.objectContaining({ id: SOUP_ID, price: 22_000 })],
  });
});

const orderBody = {
  intentId: "intent_1",
  lines: [
    {
      productId: SOUP_ID,
      variantIds: [],
      modifierIds: [],
    },
  ],
};

const orderingController = async () => {
  const tokens = new InMemoryTableQrRepository();
  const issued = TableQrToken.issue({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: NONCE,
  });
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: issued.digest,
    retired: false,
  });
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled: true,
    acceptance: "direct",
    staleAfterSeconds: 900,
  });
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
  const menus = new InMemoryMenuRepository();
  await menus.save(menu);
  const dining = new InMemoryDiningRoomRepository();
  await dining.save(
    DiningTable.place({
      id: TABLE_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      zone: "terrace",
    }),
  );
  const stations = new MemoryStations();
  const router = StationRouter.open({ venueId: VENUE_ID });
  router.assign({
    stationId: "station_grill",
    stationName: "Grill",
    productId: SOUP_ID,
    output: "both",
  });
  stations.remember(router);
  const printer = new InMemoryPrinter();
  const intents = new InMemoryQrOrderIntentRepository();
  const controller = new TableQrController(
    tokens,
    menus,
    new InMemoryVenueDirectory({ [`${TENANT_ID}:${VENUE_ID}`]: BRAND_ID }),
    new FixedClock(),
    intents,
    dining,
    stations,
    printer,
    new InMemoryRealtimeHub(),
  );

  return { controller, intents, printer };
};

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

it("given a direct table QR, when the customer submits the same order twice, then one intent is sent and the status matches", async () => {
  const { controller, intents, printer } = await orderingController();

  expect(tableQrOrderPath).toBe("m/:token/orders");
  expect(tableQrStatusPath).toBe("m/:token/orders/:intentId");
  expect(tableQrOrderPath).not.toContain("/d/");
  expect(tableQrStatusPath).not.toContain("/f/");

  const first = await controller.submit(NONCE, orderBody);
  const second = await controller.submit(NONCE, orderBody);
  const status = await controller.readStatus(NONCE, "intent_1");

  expect(first.status).toBe("applied");
  expect(first.lineIds).toEqual(["line_intent_1_0"]);
  expect(second).toEqual(first);
  expect(status).toEqual(first);
  expect(await intents.find(TENANT_ID, "intent_1")).toMatchObject({
    id: "intent_1",
  });
  expect(printer.jobs).toHaveLength(1);
});

it("given an empty cart, when the customer submits it, then no intent is stored", async () => {
  const { controller, intents } = await orderingController();

  const result = await controller.submit(NONCE, {
    intentId: "intent_empty",
    lines: [],
  });

  expect(result.status).toBe("none");
  expect(await intents.find(TENANT_ID, "intent_empty")).toBeNull();
});

it("given a forged price or void, when the customer submits it, then the order is rejected", async () => {
  const { controller, intents } = await orderingController();

  await expect(
    controller.submit(NONCE, { ...orderBody, price: 1 }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    controller.submit(NONCE, { ...orderBody, void: true }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(await intents.find(TENANT_ID, "intent_1")).toBeNull();
});
