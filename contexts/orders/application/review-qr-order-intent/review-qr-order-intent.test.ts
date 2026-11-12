import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
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
import {
  QrReviewRefused,
  ReviewQrOrderIntent,
} from "#application/review-qr-order-intent/review-qr-order-intent.js";
import { TakeOrder } from "#application/take-order/take-order.js";
import { DiningTable } from "#domain/dining-table.js";
import { Menu } from "#domain/menu.js";
import { StationRouter } from "#domain/station-router.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_3";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const INTENT_ID = "intent_1";
const SESSION_ID = "session_cashier";
const NOW = Date.parse("2026-10-28T17:03:10.000Z");

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;

const blank = {} as never;

const allowed = (): Decision => ({
  outcome: "allowed",
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: Parameters<EvaluatePermission["execute"]>[0][] = [];

  constructor(private readonly decision: Decision) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: Parameters<EvaluatePermission["execute"]>[0]) {
    this.inputs.push(input);
    return this.decision;
  }
}

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

const pendingIntent = (): StoredQrOrderIntent => ({
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

const harness = async (decision: Decision) => {
  const dining = new InMemoryDiningRoomRepository();
  await dining.save(
    DiningTable.place({
      id: TABLE_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      zone: "terrace",
    }),
  );
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
  stations.remember(router);
  const printer = new InMemoryPrinter();
  const clock = new FixedClock();
  const intents = new InMemoryQrOrderIntentRepository();
  const tokens = new InMemoryTableQrRepository();
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled: true,
    acceptance: "cash_register",
    staleAfterSeconds: 900,
  });
  await intents.insert(pendingIntent());
  const apply = new ApplyQrOrder(
    intents,
    dining,
    tokens,
    menus,
    venues,
    new TakeOrder(
      dining,
      menus,
      stations,
      printer,
      clock,
      new InMemoryRealtimeHub(),
    ),
    clock,
  );
  const permissions = new ScriptedPermission(decision);
  const review = new ReviewQrOrderIntent(intents, permissions, apply);

  return { dining, printer, intents, permissions, review };
};

it("given cash-register acceptance and sale.charge, when the cashier accepts, then the order is sent", async () => {
  const { dining, printer, permissions, review } = await harness(allowed());

  const accepted = await review.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    intentId: INTENT_ID,
    sessionId: SESSION_ID,
    decision: "accept",
  });
  const table = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);

  expect(permissions.inputs[0]?.permission).toBe(PERMISSION.SALE_CHARGE);
  expect(accepted.status).toBe("applied");
  expect(accepted.lineIds).toEqual(["line_intent_1_0"]);
  expect(table?.state).toBe("occupied");
  expect(table?.diners).toBe(1);
  expect(printer.jobs).toHaveLength(1);
});

it("given sale.charge, when the cashier rejects the order, then no line is created", async () => {
  const { dining, printer, intents, review } = await harness(allowed());

  const rejected = await review.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    intentId: INTENT_ID,
    sessionId: SESSION_ID,
    decision: "reject",
  });
  const table = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);
  const stored = await intents.find(TENANT_ID, INTENT_ID);

  expect(rejected.status).toBe("rejected");
  expect(rejected.lineIds).toEqual([]);
  expect(stored?.status).toBe("rejected");
  expect(table?.state).toBe("free");
  expect(printer.jobs).toHaveLength(0);
});

it("given sale.charge is denied, when a review is requested, then the intent stays pending", async () => {
  const { intents, review } = await harness(denied());

  await expect(
    review.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      intentId: INTENT_ID,
      sessionId: SESSION_ID,
      decision: "accept",
    }),
  ).rejects.toBeInstanceOf(QrReviewRefused);
  expect((await intents.find(TENANT_ID, INTENT_ID))?.status).toBe(
    "pending_acceptance",
  );
});
