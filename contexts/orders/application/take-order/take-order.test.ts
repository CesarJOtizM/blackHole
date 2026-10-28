import { expect, it, vi } from "vitest";

import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { MenuRepository } from "#application/ports/menu-repository.js";
import { Printer } from "#application/ports/printer.js";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";
import { StationDirectory } from "#application/ports/station-directory.js";
import {
  ProductNotOrderable,
  TakeOrder,
} from "#application/take-order/take-order.js";
import { Check, ComboNotSent, EmptyOrder } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";
import { Menu } from "#domain/menu.js";
import {
  MissingStation,
  type StationOutput,
  StationRouter,
} from "#domain/station-router.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const BRAND_ID = "organization_brand_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const MENU_ID = "menu_brand_1";
const SOUP_ID = "menu_product_soup";
const STEAK_ID = "menu_product_steak";
const SODA_ID = "menu_product_soda";
const BREAKFAST_ID = "menu_product_breakfast";
const LUNCH_ID = "menu_combo_lunch";
const SINGLE_ID = "menu_variant_single";
const CHEESE_ID = "menu_modifier_extra_cheese";
const SENT_AT = Date.parse("2026-10-28T17:03:10.000Z");
const OPENED_AT = "2026-10-28T12:00:00.000Z";

class FixedClock extends Clock {
  override now(): number {
    return SENT_AT;
  }
}

class MemoryMenus extends MenuRepository {
  private readonly menus = new Map<string, Menu>();

  override async load(tenantId: string, brandId: string): Promise<Menu | null> {
    return this.menus.get(`${tenantId}:${brandId}`) ?? null;
  }

  override async save(menu: Menu): Promise<void> {
    this.menus.set(`${menu.tenantId}:${menu.brandId}`, menu);
  }
}

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly checks = new Map<string, Check>();

  override async load(
    _tenantId: string,
    _venueId: string,
    _tableId: string,
  ): Promise<DiningTable | null> {
    return null;
  }

  override async save(_table: DiningTable): Promise<void> {}

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
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

  remember(tenantId: string, router: StationRouter): void {
    this.routers.set(`${tenantId}:${router.venueId}`, router);
  }
}

class MemoryPrinter extends Printer {
  readonly printed: string[] = [];
  fail = false;

  override async print(ticket: { text: string }): Promise<void> {
    if (this.fail) {
      throw new Error("The printer is offline.");
    }

    this.printed.push(ticket.text);
  }
}

class MemoryHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  override async publish(notice: RealtimeNotice): Promise<void> {
    this.published.push(notice);
  }
}

const publishedMenu = (): Menu => {
  const menu = Menu.open({
    id: MENU_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });

  menu.publishProduct({
    id: SOUP_ID,
    name: "Soup",
    price: 20_000,
    taxClassification: "restaurant service",
    variants: [{ id: SINGLE_ID, name: "cup" }],
    modifiers: [{ id: CHEESE_ID, name: "extra cheese", price: 3_000 }],
  });
  menu.publishProduct({
    id: STEAK_ID,
    name: "Steak",
    price: 45_000,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: SODA_ID,
    name: "Soda",
    price: 4_000,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: BREAKFAST_ID,
    name: "Breakfast",
    price: 18_000,
    taxClassification: "restaurant service",
  });
  menu.publishCombo({
    id: LUNCH_ID,
    name: "Lunch",
    price: 28_000,
    componentIds: [SOUP_ID, SODA_ID],
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: SOUP_ID,
    price: 22_000,
    available: true,
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: BREAKFAST_ID,
    price: 18_000,
    available: true,
    window: { start: "07:00", end: "11:00" },
  });

  return menu;
};

const stationFor = (
  productIds: readonly string[],
  output: StationOutput = "both",
): StationRouter => {
  const router = StationRouter.open({ venueId: VENUE_ID });
  const stationId = output === "printer" ? "station_bar" : "station_grill";
  const stationName = output === "printer" ? "Bar" : "Grill";

  for (const productId of productIds) {
    router.assign({
      stationId,
      stationName,
      productId,
      output,
    });
  }

  return router;
};

const harness = async (
  productIds: readonly string[],
  output: StationOutput = "both",
) => {
  const menus = new MemoryMenus();
  const menu = publishedMenu();
  await menus.save(menu);
  const dining = new MemoryDiningRoom();
  await dining.saveCheck(
    Check.open({
      id: CHECK_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      tableId: TABLE_ID,
      openedAt: OPENED_AT,
    }),
  );
  const stations = new MemoryStations();
  stations.remember(TENANT_ID, stationFor(productIds, output));
  const printer = new MemoryPrinter();
  const hub = new MemoryHub();
  const takeOrder = new TakeOrder(
    dining,
    menus,
    stations,
    printer,
    new FixedClock(),
    hub,
  );
  const saveTable = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");

  return { menu, dining, printer, hub, takeOrder, saveTable, saveCheck };
};

const expectNothingSaved = async (
  dining: MemoryDiningRoom,
  printer: MemoryPrinter,
  saveTable: ReturnType<typeof vi.spyOn>,
  saveCheck: ReturnType<typeof vi.spyOn>,
) => {
  expect(saveTable).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(printer.printed).toEqual([]);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders).toEqual([]);
  expect(stored?.total).toBe(0);
};

it("given course 1, when sent, then the quoted line keeps its variant, modifier, note, and channel while mains stay held", async () => {
  const { menu, dining, printer, takeOrder, saveTable, saveCheck } =
    await harness([SOUP_ID]);
  const quoted = menu.quote({
    venueId: VENUE_ID,
    productId: SOUP_ID,
    modifierIds: [CHEESE_ID],
  });
  const held = menu.quote({
    venueId: VENUE_ID,
    productId: STEAK_ID,
    modifierIds: [],
  });

  const sent = await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "fixed_point",
        variantIds: [SINGLE_ID],
        modifierIds: [CHEESE_ID],
        note: "no onion",
      },
      {
        orderId: ORDER_ID,
        lineId: "line_steak",
        productId: STEAK_ID,
        name: "Steak",
        course: 2,
        channel: "fixed_point",
      },
    ],
  });

  expect(quoted).toBe(25_000);
  expect(held).toBe(45_000);
  expect(sent.orders).toEqual([
    {
      id: ORDER_ID,
      channel: "fixed_point",
      lines: [
        {
          id: "line_soup",
          productId: SOUP_ID,
          name: "Soup",
          course: 1,
          price: quoted,
          state: "sent",
          sentAt: new Date(SENT_AT).toISOString(),
          originTableId: TABLE_ID,
          variantIds: [SINGLE_ID],
          modifierIds: [CHEESE_ID],
          note: "no onion",
        },
        {
          id: "line_steak",
          productId: STEAK_ID,
          name: "Steak",
          course: 2,
          price: held,
          state: "held",
          originTableId: TABLE_ID,
        },
      ],
    },
  ]);
  expect(sent.total).toBe(quoted);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders).toEqual(sent.orders);
  expect(stored?.total).toBe(quoted);
  expect(saveTable).not.toHaveBeenCalled();
  expect(saveCheck).toHaveBeenCalledTimes(1);
  expect(printer.printed).toEqual(["Grill\ntable_5\nSoup\nno onion"]);
});

it("given a product outside its schedule, when it is sent, then ProductNotOrderable and nothing is saved", async () => {
  const { dining, printer, takeOrder, saveTable, saveCheck } = await harness([
    BREAKFAST_ID,
  ]);

  const send = takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_breakfast",
        productId: BREAKFAST_ID,
        name: "Breakfast",
        course: 1,
        channel: "waiter",
      },
    ],
  });

  await expect(send).rejects.toThrow(ProductNotOrderable);
  await expectNothingSaved(dining, printer, saveTable, saveCheck);
});

it("given a combo, when it is sent, then ComboNotSent and nothing is saved", async () => {
  const { dining, printer, takeOrder, saveTable, saveCheck } = await harness(
    [],
  );

  const send = takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_lunch",
        productId: LUNCH_ID,
        name: "Lunch",
        course: 1,
        channel: "waiter",
        kind: "combo",
      },
    ],
  });

  await expect(send).rejects.toThrow(ComboNotSent);
  await expectNothingSaved(dining, printer, saveTable, saveCheck);
});

it("given an empty send, when course 1 is sent, then EmptyOrder and nothing is saved", async () => {
  const { dining, printer, takeOrder, saveTable, saveCheck } = await harness(
    [],
  );

  const send = takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [],
  });

  await expect(send).rejects.toThrow(EmptyOrder);
  await expectNothingSaved(dining, printer, saveTable, saveCheck);
});

it("given a product with no station, when it is sent, then MissingStation and nothing is saved", async () => {
  const { dining, printer, takeOrder, saveTable, saveCheck } = await harness(
    [],
  );

  const send = takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "waiter",
        modifierIds: [CHEESE_ID],
      },
    ],
  });

  await expect(send).rejects.toThrow(MissingStation);
  await expectNothingSaved(dining, printer, saveTable, saveCheck);
});

it("given a sent soup, when it is resent, then only that product is routed and the total is unchanged", async () => {
  const { menu, dining, printer, takeOrder } = await harness([
    SOUP_ID,
    SODA_ID,
  ]);
  const soup = menu.quote({
    venueId: VENUE_ID,
    productId: SOUP_ID,
    modifierIds: [],
  });
  const soda = menu.quote({
    venueId: VENUE_ID,
    productId: SODA_ID,
    modifierIds: [],
  });

  const sent = await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "waiter",
      },
      {
        orderId: ORDER_ID,
        lineId: "line_soda",
        productId: SODA_ID,
        name: "Soda",
        course: 1,
        channel: "waiter",
      },
    ],
  });
  const before = {
    total: sent.total,
    orders: structuredClone(sent.orders),
  };
  printer.printed.length = 0;

  const resent = await takeOrder.resend({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: "line_soup",
  });

  expect(soup).toBe(22_000);
  expect(soda).toBe(4_000);
  expect(before.total).toBe(soup + soda);
  expect(resent.total).toBe(before.total);
  expect(resent.orders).toEqual(before.orders);
  expect(printer.printed).toEqual(["Grill\ntable_5\nSoup"]);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.total).toBe(before.total);
  expect(stored?.orders).toEqual(before.orders);
});

it("given output both and a failed printer, when a product is sent, then the line stays and printer_failed is published", async () => {
  const { dining, printer, hub, takeOrder } = await harness([SOUP_ID]);
  printer.fail = true;

  const sent = await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "waiter",
      },
    ],
  });

  expect(sent.orders[0]?.lines[0]?.state).toBe("sent");
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders).toEqual(sent.orders);
  expect(stored?.total).toBe(sent.total);
  expect(printer.printed).toEqual([]);
  expect(hub.published).toContainEqual({
    kind: "printer_failed",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    tableId: TABLE_ID,
    lineId: "line_soup",
    stationId: "station_grill",
  });
});

it("given printer only, when the printer fails, then the alert includes the unprinted UTF-8 ticket", async () => {
  const { dining, printer, hub, takeOrder } = await harness(
    [SODA_ID],
    "printer",
  );
  const ticket = "Bar\ntable_5\nSoda\njalapeño";
  printer.fail = true;

  const sent = await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soda",
        productId: SODA_ID,
        name: "Soda",
        course: 1,
        channel: "waiter",
        note: "jalapeño",
      },
    ],
  });

  expect(sent.orders[0]?.lines[0]?.state).toBe("sent");
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders[0]?.lines[0]?.state).toBe("sent");
  const alert = hub.published.find(
    (notice) => notice.kind === "printer_failed",
  );
  expect(alert).toEqual({
    kind: "printer_failed",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    tableId: TABLE_ID,
    lineId: "line_soda",
    stationId: "station_bar",
    text: ticket,
  });
  const text = alert && "text" in alert ? (alert.text ?? "") : "";
  const encoded = new TextEncoder().encode(text);
  const controls = [...encoded].filter(
    (byte) => (byte < 32 && byte !== 10) || byte === 127,
  );
  expect(text).toBe(ticket);
  expect(new TextDecoder().decode(encoded)).toBe(ticket);
  expect(encoded.includes(0x1b)).toBe(false);
  expect(encoded.includes(0x1d)).toBe(false);
  expect(controls).toEqual([]);
});

it("given a send, when the product is sent, then RealtimeHub gets the check, table, and line ids", async () => {
  const { hub, takeOrder } = await harness([SOUP_ID]);

  await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "waiter",
      },
    ],
  });

  expect(hub.published).toEqual([
    {
      kind: "ids",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      lineIds: ["line_soup"],
    },
  ]);
});

it("given check_requested, when another product is sent, then the table returns to occupied", async () => {
  const { menu, dining, takeOrder } = await harness([SOUP_ID, SODA_ID]);
  const soup = menu.quote({
    venueId: VENUE_ID,
    productId: SOUP_ID,
    modifierIds: [],
  });
  const soda = menu.quote({
    venueId: VENUE_ID,
    productId: SODA_ID,
    modifierIds: [],
  });

  await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soup",
        productId: SOUP_ID,
        name: "Soup",
        course: 1,
        channel: "waiter",
      },
    ],
  });
  const requested = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  requested?.requestCheck();

  expect(requested?.tableState).toBe("check_requested");

  const sent = await takeOrder.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    course: 1,
    lines: [
      {
        orderId: ORDER_ID,
        lineId: "line_soda",
        productId: SODA_ID,
        name: "Soda",
        course: 1,
        channel: "waiter",
      },
    ],
  });

  expect(sent.tableState).toBe("occupied");
  expect(sent.total).toBe(soup + soda);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.tableState).toBe("occupied");
  expect(stored?.total).toBe(soup + soda);
});
