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
import { EvaluatePermission } from "@blackhole/platform/application/entry-port";
import { ForbiddenException } from "@nestjs/common";
import { expect, it } from "vitest";
import {
  reprintTableQrPath,
  reviewQrOrderPath,
  routePermissions,
  staleQrOrdersPath,
  TableQrAdminController,
} from "#src/http/table-qr-admin.controller.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_3";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const CURRENT_NONCE = "table-qr-nonce-0001";
const NEXT_NONCE = "table-qr-nonce-0002";
const SESSION_ID = "session_cashier";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOW;
  }
}

class ScriptedPermission extends EvaluatePermission {
  constructor(private readonly allowed: boolean) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(): Promise<{
    outcome: "allowed" | "denied";
    selfAuthorized: false;
  }> {
    return Promise.resolve(
      this.allowed
        ? { outcome: "allowed", selfAuthorized: false }
        : { outcome: "denied", selfAuthorized: false },
    );
  }
}

class MemoryStations extends StationDirectory {
  private readonly routers = new Map<string, StationRouter>();

  override async load(
    _tenantId: string,
    venueId: string,
  ): Promise<StationRouter | null> {
    return this.routers.get(venueId) ?? null;
  }

  remember(router: StationRouter): void {
    this.routers.set(router.venueId, router);
  }
}

const staffWorld = async (allowed: boolean) => {
  const tokens = new InMemoryTableQrRepository();
  const current = TableQrToken.issue({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: CURRENT_NONCE,
  });
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: current.digest,
    retired: false,
  });
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled: true,
    acceptance: "cash_register",
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
  const controller = new TableQrAdminController(
    tokens,
    intents,
    new ScriptedPermission(allowed),
    dining,
    menus,
    new InMemoryVenueDirectory({ [`${TENANT_ID}:${VENUE_ID}`]: BRAND_ID }),
    stations,
    printer,
    new InMemoryRealtimeHub(),
    new FixedClock(),
  );

  return { controller, tokens, intents, dining, printer, current };
};

const pendingIntent = (
  id: string,
  createdAt: string,
  status: "pending_acceptance" | "applied" = "pending_acceptance",
) => ({
  id,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  status,
  lines: [
    {
      productId: SOUP_ID,
      name: "Soup",
      variantIds: [] as const,
      modifierIds: [] as const,
      unitPrice: 22_000,
    },
  ],
  unavailableProductIds: [] as const,
  sentLineIds: [] as const,
  checkId: status === "applied" ? "check_old" : null,
  createdAt,
});

it("given sale.reprint, when staff reprints the table QR, then the new path is /m/ and the previous digest is retired", async () => {
  const { controller, tokens, current } = await staffWorld(true);

  expect(reprintTableQrPath).toBe("venues/:venueId/tables/:tableId/qr");
  expect(reprintTableQrPath).not.toContain("/d/");
  expect(reprintTableQrPath).not.toContain("/f/");
  expect(routePermissions).toMatchObject({
    [reprintTableQrPath]: "sale.reprint",
  });

  const issued = await controller.reprint(
    TENANT_ID,
    VENUE_ID,
    TABLE_ID,
    SESSION_ID,
    { nonce: NEXT_NONCE },
  );

  expect(issued.path).toBe(`/m/${NEXT_NONCE}`);
  expect(issued.digest).not.toBe(current.digest);
  expect(await tokens.findByDigest(current.digest)).toMatchObject({
    retired: true,
  });
  expect(await tokens.findByDigest(issued.digest)).toMatchObject({
    retired: false,
    tableId: TABLE_ID,
  });
});

it("given sale.reprint is denied, when staff reprints the table QR, then the previous digest stays current", async () => {
  const { controller, tokens, current } = await staffWorld(false);

  await expect(
    controller.reprint(TENANT_ID, VENUE_ID, TABLE_ID, SESSION_ID, {
      nonce: NEXT_NONCE,
    }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(await tokens.findByDigest(current.digest)).toMatchObject({
    retired: false,
  });
});

it("given cash-register acceptance and sale.charge, when the cashier accepts, then the QR order is sent", async () => {
  const { controller, intents, dining, printer } = await staffWorld(true);
  await intents.insert(pendingIntent("intent_1", new Date(NOW).toISOString()));

  expect(reviewQrOrderPath).toBe("venues/:venueId/qr-orders/:intentId");
  expect(reviewQrOrderPath).not.toContain("/f/");
  expect(routePermissions).toMatchObject({
    [reviewQrOrderPath]: "sale.charge",
  });

  const reviewed = await controller.review(
    TENANT_ID,
    VENUE_ID,
    "intent_1",
    SESSION_ID,
    { decision: "accept" },
  );

  expect(reviewed).toMatchObject({
    intentId: "intent_1",
    status: "applied",
    lineIds: ["line_intent_1_0"],
  });
  expect(printer.jobs).toHaveLength(1);
  expect(
    (await dining.loadCheck(TENANT_ID, VENUE_ID, "check_intent_1"))?.orders[0]
      ?.channel,
  ).toBe("qr_table");
});

it("given sale.charge, when the cashier rejects the QR order, then no line is sent", async () => {
  const { controller, intents, dining, printer } = await staffWorld(true);
  await intents.insert(
    pendingIntent("intent_reject", new Date(NOW).toISOString()),
  );

  const reviewed = await controller.review(
    TENANT_ID,
    VENUE_ID,
    "intent_reject",
    SESSION_ID,
    { decision: "reject" },
  );

  expect(reviewed.status).toBe("rejected");
  expect(reviewed.lineIds).toEqual([]);
  expect(printer.jobs).toHaveLength(0);
  expect((await dining.load(TENANT_ID, VENUE_ID, TABLE_ID))?.diners).toBe(0);
});

it("given pending QR orders older than 900 seconds, when staff lists them, then a 20 minute order is stale and a 2 minute order is not", async () => {
  const { controller, intents } = await staffWorld(true);
  await intents.insert(
    pendingIntent("intent_old", new Date(NOW - 20 * 60 * 1000).toISOString()),
  );
  await intents.insert(
    pendingIntent("intent_fresh", new Date(NOW - 2 * 60 * 1000).toISOString()),
  );
  await intents.insert(
    pendingIntent(
      "intent_done",
      new Date(NOW - 20 * 60 * 1000).toISOString(),
      "applied",
    ),
  );

  expect(staleQrOrdersPath).toBe("venues/:venueId/qr-orders");
  expect(staleQrOrdersPath).not.toContain("/d/");
  expect(routePermissions).toMatchObject({
    [staleQrOrdersPath]: "sale.charge",
  });

  const stale = await controller.stale(TENANT_ID, VENUE_ID, SESSION_ID);

  expect(stale).toEqual([{ intentId: "intent_old", ageSeconds: 1200 }]);
});

it("given sale.charge is denied, when staff lists stale QR orders, then the list is refused", async () => {
  const { controller } = await staffWorld(false);

  await expect(
    controller.stale(TENANT_ID, VENUE_ID, SESSION_ID),
  ).rejects.toBeInstanceOf(ForbiddenException);
});
