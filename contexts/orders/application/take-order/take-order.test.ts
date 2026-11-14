import {
  ConsumeAuthorization,
  CountExecutedOperations,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it, vi } from "vitest";
import { InMemoryDiningRoomRepository } from "#adapters/memory/in-memory-dining-room-repository.js";
import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { MenuRepository } from "#application/ports/menu-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
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
import { DiningTable } from "#domain/dining-table.js";
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
const WAITER_ID = "user_waiter";
const SESSION_ID = "session_waiter";
const DEVICE_ID = "device_waiter";
const SHIFT_ID = "shift_1";
const REASON = "Guest asked for a soda after the pre-bill";
const SHIFT_TOTALS = {
  waiterVoidsBeforeKitchen: 2,
  compShiftCop: 90_000,
};

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

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

type PrintStatus = "waiting" | "printed" | "failed";

class MemoryPrinter extends Printer {
  readonly jobs: unknown[] = [];
  status: PrintStatus = "waiting";

  override async enqueue(job: { kickDrawer: boolean }): Promise<{
    status: PrintStatus;
    kickDrawer: boolean;
  }> {
    this.jobs.push(job);

    return { status: this.status, kickDrawer: job.kickDrawer };
  }
}

class MemoryHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  override async publish(notice: RealtimeNotice): Promise<void> {
    this.published.push(notice);
  }
}

class MemoryShift extends OpenShiftReader {
  readonly queries: { tenantId: string; venueId: string; shiftId: string }[] =
    [];

  override async isOpen(query: {
    tenantId: string;
    venueId: string;
    shiftId: string;
  }): Promise<boolean> {
    this.queries.push(query);
    return true;
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: { tenantId: string; actorId: string; shiftId: string }[] =
    [];

  constructor() {
    super(blank);
  }

  override async execute(query: {
    tenantId: string;
    actorId: string;
    shiftId: string;
  }) {
    this.queries.push(query);
    return SHIFT_TOTALS;
  }
}

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: PermissionInput[] = [];

  constructor(private readonly decision: Decision) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: PermissionInput) {
    this.inputs.push(input);
    return this.decision;
  }
}

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: unknown[] = [];

  constructor() {
    super(blank, blank);
  }

  override async execute(input: unknown): Promise<boolean> {
    this.calls.push(input);
    return false;
  }
}

class RecordingAudit extends RecordAuditEvent {
  readonly commands: AuditCommand[] = [];

  constructor() {
    super(blank, blank, blank);
  }

  override async execute(command: AuditCommand) {
    this.commands.push(command);
    return blank;
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

const lineIds = (check: Check | null): string[] =>
  check?.orders.flatMap((order) => order.lines.map((line) => line.id)) ?? [];

interface SaleConsumptionDouble {
  saleConsumptionEnabled: boolean;
  registerSaleConsumption: {
    execute(input: {
      tenantId: string;
      venueId: string;
      generation: number;
      orderLineId: string;
      productId: string;
      variantIds: readonly string[];
      modifierIds: readonly string[];
      portions: number;
      occurredAt: string;
    }): Promise<{ missingRecipe: boolean }>;
  };
  generationOf(tenantId: string, venueId: string): Promise<number>;
}

const harness = async (
  productIds: readonly string[],
  output: StationOutput = "both",
  printedCheck?: {
    shifts: OpenShiftReader;
    counts: CountExecutedOperations;
    permissions: EvaluatePermission;
    grants: ConsumeAuthorization;
    audits: RecordAuditEvent;
  },
  saleConsumption?: SaleConsumptionDouble,
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
    printedCheck,
    saleConsumption,
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
  expect(printer.jobs).toEqual([]);
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
  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soup",
      stationId: "station_grill",
      station: "Grill",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup", note: "no onion" }],
      kickDrawer: false,
    },
  ]);
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
  printer.jobs.length = 0;

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
  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soup:resend",
      stationId: "station_grill",
      station: "Grill",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup" }],
      kickDrawer: false,
    },
  ]);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.total).toBe(before.total);
  expect(stored?.orders).toEqual(before.orders);
});

it("given output both and a failed printer, when a product is sent, then the line stays and printer_failed is published", async () => {
  const { dining, printer, hub, takeOrder } = await harness([SOUP_ID]);
  printer.status = "failed";

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
  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soup",
      stationId: "station_grill",
      station: "Grill",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup" }],
      kickDrawer: false,
    },
  ]);
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
  printer.status = "failed";

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
  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soda",
      stationId: "station_bar",
      station: "Bar",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soda", note: "jalapeño" }],
      kickDrawer: false,
    },
  ]);
});

it("given a send, when the product is sent, then RealtimeHub gets the check, table, and line ids", async () => {
  const { hub, printer, takeOrder } = await harness([SOUP_ID]);

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
    {
      kind: "printer_failed",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      lineId: "line_soup",
      stationId: "station_grill",
    },
  ]);
  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soup",
      stationId: "station_grill",
      station: "Grill",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup" }],
      kickDrawer: false,
    },
  ]);
});

it("given a kitchen job that is already printed, when a product is sent, then the ticket is enqueued with no kick and printer_failed is not published", async () => {
  const { hub, printer, takeOrder } = await harness([SOUP_ID]);
  printer.status = "printed";

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

  expect(printer.jobs).toEqual([
    {
      document: "kitchen_ticket",
      commandId: "kitchen_ticket:check_5:line_soup",
      stationId: "station_grill",
      station: "Grill",
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup" }],
      kickDrawer: false,
    },
  ]);
  expect(hub.published.map((notice) => notice.kind)).toEqual(["ids"]);
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

it("given a printed pre-bill, when a waiter adds a product without sale.edit-printed-check, then the account stays unchanged", async () => {
  const shifts = new MemoryShift();
  const counts = new FixedCounts();
  const permissions = new ScriptedPermission(denied());
  const grants = new MemoryGrant();
  const audits = new RecordingAudit();
  const { menu, dining, printer, hub, takeOrder, saveCheck } = await harness(
    [SOUP_ID, SODA_ID],
    "both",
    { shifts, counts, permissions, grants, audits },
  );
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
  const open = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  open?.requestCheck({ requestedAt: new Date(SENT_AT).toISOString() });

  if (open) {
    await dining.saveCheck(open);
  }

  const stamped = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  const linesBefore = lineIds(stamped);
  const jobsBefore = printer.jobs.length;
  const noticesBefore = hub.published.length;
  const savesBefore = saveCheck.mock.calls.length;

  const held = await takeOrder.hold({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    line: {
      orderId: ORDER_ID,
      lineId: "line_soda",
      productId: SODA_ID,
      name: "Soda",
      course: 1,
      channel: "waiter",
    },
    edit: {
      actorId: WAITER_ID,
      authorizerId: null,
      sessionId: SESSION_ID,
      deviceId: DEVICE_ID,
      shiftId: SHIFT_ID,
      reason: REASON,
      authorizationId: null,
    },
  });
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  expect(lineIds(stored)).toEqual(linesBefore);
  expect(stored?.total).toBe(soup);
  expect(held.total).toBe(soup);
  expect(saveCheck).toHaveBeenCalledTimes(savesBefore);
  expect(printer.jobs).toHaveLength(jobsBefore);
  expect(hub.published).toHaveLength(noticesBefore);
  expect(shifts.queries).toEqual([
    { tenantId: TENANT_ID, venueId: VENUE_ID, shiftId: SHIFT_ID },
  ]);
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: WAITER_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs).toEqual([
    {
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      permission: PERMISSION.SALE_EDIT_PRINTED_CHECK,
      target: { kind: "site", id: VENUE_ID, brandId: null },
      value: soda,
      supportGrantId: null,
      shiftTotals: SHIFT_TOTALS,
    },
  ]);
  expect(grants.calls).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given an open check on a table, when it is loaded by table, then that check is returned", async () => {
  const dining = new InMemoryDiningRoomRepository();
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "terrace",
  });
  table.open({ diners: 4 });
  await dining.save(table);
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  await dining.saveCheck(check);

  const loaded = await dining.loadOpenCheckByTable(
    TENANT_ID,
    VENUE_ID,
    TABLE_ID,
  );

  expect(loaded?.id).toBe(CHECK_ID);
  expect(
    await dining.loadOpenCheckByTable(TENANT_ID, VENUE_ID, "table_9"),
  ).toBeNull();
  expect(
    await dining.loadOpenCheckByTable(
      "organization_tenant_2",
      VENUE_ID,
      TABLE_ID,
    ),
  ).toBeNull();
});

it("given a QR table line, when it is sent, then the kitchen job carries the qr_table channel", async () => {
  const { printer, takeOrder } = await harness([SOUP_ID]);

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
        channel: "qr_table",
      },
    ],
  });

  expect(printer.jobs[0]).toMatchObject({
    document: "kitchen_ticket",
    channel: "qr_table",
    table: TABLE_ID,
    lines: [{ quantity: "1", name: "Soup" }],
  });
});

const GENERATION = 4;
const SENT_AT_ISO = new Date(SENT_AT).toISOString();

const fireCourse = {
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  course: 1,
};

const holdLine = (
  lineId: string,
  productId: string,
  name: string,
  course: number,
  variantIds?: readonly string[],
  modifierIds?: readonly string[],
) => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  line: {
    orderId: ORDER_ID,
    lineId,
    productId,
    name,
    course,
    channel: "waiter",
    ...(variantIds === undefined ? {} : { variantIds: [...variantIds] }),
    ...(modifierIds === undefined ? {} : { modifierIds: [...modifierIds] }),
  },
});

const recordingConsumption = (
  enabled: boolean,
  missingRecipe = false,
): {
  sale: SaleConsumptionDouble;
  calls: Array<{
    orderLineId: string;
    portions: number;
    generation: number;
    occurredAt: string;
    variantIds: readonly string[];
    modifierIds: readonly string[];
    productId: string;
  }>;
  sequence: string[];
} => {
  const calls: Array<{
    orderLineId: string;
    portions: number;
    generation: number;
    occurredAt: string;
    variantIds: readonly string[];
    modifierIds: readonly string[];
    productId: string;
  }> = [];
  const sequence: string[] = [];
  const sale: SaleConsumptionDouble = {
    saleConsumptionEnabled: enabled,
    generationOf: async () => GENERATION,
    registerSaleConsumption: {
      execute: async (input) => {
        sequence.push("consume");
        calls.push(input);
        return { missingRecipe };
      },
    },
  };

  return { sale, calls, sequence };
};

it("given held lines and sale consumption on, when the course is fired, then each line leaving held is consumed once with portions 1 after send and before save", async () => {
  const { sale, calls, sequence } = recordingConsumption(true);
  const { dining, takeOrder, saveCheck } = await harness(
    [SOUP_ID, SODA_ID, STEAK_ID],
    "both",
    undefined,
    sale,
  );
  const originalSend = Check.prototype.send;
  const send = vi.spyOn(Check.prototype, "send").mockImplementation(function (
    this: Check,
    input: Parameters<Check["send"]>[0],
  ) {
    sequence.push("send");
    return originalSend.call(this, input);
  });

  await takeOrder.hold(
    holdLine("line_soup", SOUP_ID, "Soup", 1, [SINGLE_ID], [CHEESE_ID]),
  );
  await takeOrder.hold(holdLine("line_soda", SODA_ID, "Soda", 1));
  await takeOrder.hold(holdLine("line_steak", STEAK_ID, "Steak", 2));
  saveCheck.mockImplementation(async (check: Check) => {
    sequence.push("save");
    return MemoryDiningRoom.prototype.saveCheck.call(dining, check);
  });

  try {
    await takeOrder.fire(fireCourse);

    const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

    expect(sequence).toEqual(["send", "consume", "consume", "save"]);
    expect(calls).toEqual([
      {
        tenantId: TENANT_ID,
        venueId: VENUE_ID,
        generation: GENERATION,
        orderLineId: "line_soup",
        productId: SOUP_ID,
        variantIds: [SINGLE_ID],
        modifierIds: [CHEESE_ID],
        portions: 1,
        occurredAt: SENT_AT_ISO,
      },
      {
        tenantId: TENANT_ID,
        venueId: VENUE_ID,
        generation: GENERATION,
        orderLineId: "line_soda",
        productId: SODA_ID,
        variantIds: [],
        modifierIds: [],
        portions: 1,
        occurredAt: SENT_AT_ISO,
      },
    ]);
    expect(stored?.orders.flatMap((order) => order.lines)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "line_soup", state: "sent" }),
        expect.objectContaining({ id: "line_soda", state: "sent" }),
        expect.objectContaining({ id: "line_steak", state: "held" }),
      ]),
    );

    await expect(takeOrder.fire(fireCourse)).rejects.toBeInstanceOf(EmptyOrder);
    expect(calls).toHaveLength(2);
  } finally {
    send.mockRestore();
  }
});

it("given sale consumption off, when a held course is fired, then the inventory port is not called and the line is still sent", async () => {
  const { sale, calls } = recordingConsumption(false);
  const { dining, takeOrder } = await harness(
    [SOUP_ID],
    "both",
    undefined,
    sale,
  );

  await takeOrder.hold(holdLine("line_soup", SOUP_ID, "Soup", 1));
  await takeOrder.fire(fireCourse);

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  const soup = stored?.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === "line_soup");

  expect(calls).toEqual([]);
  expect(soup?.state).toBe("sent");
});

it("given a held line whose recipe is missing, when the course is fired, then the check is still saved", async () => {
  const { sale, calls } = recordingConsumption(true, true);
  const { dining, takeOrder, saveCheck } = await harness(
    [SOUP_ID],
    "both",
    undefined,
    sale,
  );

  await takeOrder.hold(holdLine("line_soup", SOUP_ID, "Soup", 1));
  const saved = await takeOrder.fire(fireCourse);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderLineId).toBe("line_soup");
  expect(saved.orders[0]?.lines[0]?.state).toBe("sent");
  expect(stored?.orders[0]?.lines[0]?.state).toBe("sent");
  expect(saveCheck).toHaveBeenCalled();
});
