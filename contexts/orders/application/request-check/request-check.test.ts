import { expect, it, vi } from "vitest";

import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  PreBillLink,
  type PreBillLinkInput,
} from "#application/ports/pre-bill-link.js";
import { Printer } from "#application/ports/printer.js";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";
import { RequestCheck } from "#application/request-check/request-check.js";
import { Check, TableNotOpen } from "#domain/check.js";
import {
  DiningTable,
  TableAlreadyOccupied,
  type TableState,
} from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const REQUESTED_AT = Date.parse("2026-10-28T12:15:00.000Z");

class FixedClock extends Clock {
  override now(): number {
    return REQUESTED_AT;
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

class MemoryPreBillLink extends PreBillLink {
  readonly signed: PreBillLinkInput[] = [];

  constructor(private readonly qr: string) {
    super();
  }

  override async sign(input: PreBillLinkInput): Promise<string> {
    this.signed.push(input);

    return this.qr;
  }
}

const disabledLink = (): MemoryPreBillLink => new MemoryPreBillLink("");

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly tables = new Map<string, DiningTable>();
  private readonly checks = new Map<string, Check>();

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    return this.tables.get(`${tenantId}:${venueId}:${tableId}`) ?? null;
  }

  override async save(table: DiningTable): Promise<void> {
    this.tables.set(`${table.tenantId}:${table.venueId}:${table.id}`, table);
  }

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

const placeTable = (state: TableState): DiningTable => {
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  if (state === "free") {
    return table;
  }

  table.open({ diners: 4 });

  if (state === "check_requested") {
    table.requestCheck();
  }

  if (state === "to_clean") {
    table.release();
  }

  return table;
};

const seat = async (input: {
  table: TableState;
  check: "occupied" | "check_requested";
  link?: PreBillLink;
}) => {
  const dining = new MemoryDiningRoom();
  const table = placeTable(input.table);
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  if (input.check === "check_requested") {
    check.requestCheck();
  }

  await dining.save(table);
  await dining.saveCheck(check);
  const printer = new MemoryPrinter();
  const hub = new MemoryHub();
  const link = input.link ?? disabledLink();

  return {
    dining,
    printer,
    hub,
    link,
    requestCheck: new RequestCheck(
      dining,
      new FixedClock(),
      printer,
      hub,
      link,
    ),
  };
};

it("given occupied, when the bill is requested, then check_requested and a pre-bill request are stored", async () => {
  const { dining, requestCheck } = await seat({
    table: "occupied",
    check: "occupied",
  });
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  await requestCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  const storedTable = await dining.load(TENANT_ID, VENUE_ID, TABLE_ID);
  const storedCheck = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(storedTable?.state).toBe("check_requested");
  expect(storedTable?.diners).toBe(4);
  expect(storedTable?.zone).toBe("Terrace");
  expect(storedCheck?.tableState).toBe("check_requested");
  expect(storedCheck?.preBillRequest).toEqual({
    requestedAt: "2026-10-28T12:15:00.000Z",
  });
  expect(save).toHaveBeenCalledOnce();
  expect(saveCheck).toHaveBeenCalledOnce();
  expect(saveChecks).not.toHaveBeenCalled();
});

it("given a rejection, when the bill is requested, then nothing is saved", async () => {
  const cases = [
    {
      table: "free",
      check: "occupied",
      error: TableAlreadyOccupied,
    },
    {
      table: "to_clean",
      check: "occupied",
      error: TableAlreadyOccupied,
    },
    {
      table: "check_requested",
      check: "occupied",
      error: TableAlreadyOccupied,
    },
    {
      table: "occupied",
      check: "check_requested",
      error: TableNotOpen,
    },
  ] as const;

  for (const attempt of cases) {
    const { dining, printer, hub, requestCheck } = await seat({
      table: attempt.table,
      check: attempt.check,
    });
    const save = vi.spyOn(dining, "save");
    const saveCheck = vi.spyOn(dining, "saveCheck");
    const saveChecks = vi.spyOn(dining, "saveChecks");

    const request = requestCheck.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    });

    await expect(request).rejects.toThrow(attempt.error);
    expect(save).not.toHaveBeenCalled();
    expect(saveCheck).not.toHaveBeenCalled();
    expect(saveChecks).not.toHaveBeenCalled();
    expect((await dining.load(TENANT_ID, VENUE_ID, TABLE_ID))?.state).toBe(
      attempt.table,
    );
    expect(
      (await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID))?.tableState,
    ).toBe(attempt.check);
    expect(
      (await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID))?.preBillRequest,
    ).toBeUndefined();
    expect(printer.jobs).toEqual([]);
    expect(hub.published).toEqual([]);
  }
});

const billableCheck = async () => {
  const dining = new MemoryDiningRoom();
  const table = placeTable("occupied");
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_1",
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 22_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: "order_1",
    lineId: "line_steak",
    productId: "menu_product_steak",
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: OPENED_AT });
  await dining.save(table);
  await dining.saveCheck(check);
  const printer = new MemoryPrinter();
  const hub = new MemoryHub();
  const link = disabledLink();

  return {
    dining,
    printer,
    hub,
    link,
    requestCheck: new RequestCheck(
      dining,
      new FixedClock(),
      printer,
      hub,
      link,
    ),
  };
};

it("given the portal is enabled, when the bill is requested, then the pre-bill qr is a signed /d/ link", async () => {
  const link = new MemoryPreBillLink("/d/check_5.signed");
  const { printer, requestCheck } = await seat({
    table: "occupied",
    check: "occupied",
    link,
  });

  await requestCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(printer.jobs).toEqual([
    expect.objectContaining({
      document: "pre_bill",
      qr: "/d/check_5.signed",
      kickDrawer: false,
    }),
  ]);
  expect(link.signed).toEqual([
    {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      at: "2026-10-28T12:15:00.000Z",
    },
  ]);
});

it("given the portal is disabled, when the bill is requested, then the pre-bill qr stays empty", async () => {
  const { printer, link, requestCheck } = await seat({
    table: "occupied",
    check: "occupied",
  });

  await requestCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(printer.jobs).toEqual([
    expect.objectContaining({
      document: "pre_bill",
      qr: "",
    }),
  ]);
  expect(link).toBeInstanceOf(MemoryPreBillLink);
  expect((link as MemoryPreBillLink).signed).toEqual([
    {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      at: "2026-10-28T12:15:00.000Z",
    },
  ]);
});

it("given a sent soup and a held steak, when the bill is requested, then a pre-bill is enqueued with no kick and waiting publishes printer_failed", async () => {
  const { dining, printer, hub, requestCheck } = await billableCheck();

  await requestCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(printer.jobs).toEqual([
    {
      document: "pre_bill",
      commandId: `pre_bill:${CHECK_ID}:2026-10-28T12:15:00.000Z`,
      table: TABLE_ID,
      lines: [{ quantity: "1", name: "Soup", amount: "22000" }],
      total: "22000",
      qr: "",
      kickDrawer: false,
    },
  ]);
  expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
  expect(new TextEncoder().encode(JSON.stringify(printer.jobs))).not.toContain(
    0x1b,
  );
  expect(hub.published).toEqual([
    {
      kind: "printer_failed",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
    },
  ]);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.tableState).toBe("check_requested");
  expect(stored?.total).toBe(22_000);
});

it("given a pre-bill that fails, when the bill is requested, then printer_failed is published and the check stays requested", async () => {
  const { dining, printer, hub, requestCheck } = await billableCheck();
  printer.status = "failed";

  await requestCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(printer.jobs).toEqual([
    expect.objectContaining({
      document: "pre_bill",
      kickDrawer: false,
    }),
  ]);
  expect(hub.published).toEqual([
    {
      kind: "printer_failed",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
    },
  ]);
  expect(
    (await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID))?.tableState,
  ).toBe("check_requested");
});
