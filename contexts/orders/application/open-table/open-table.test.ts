import { expect, it, vi } from "vitest";

import { OpenTable } from "#application/open-table/open-table.js";
import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { type Check, InvalidCheckId } from "#domain/check.js";
import { DiningTable, TableAlreadyOccupied } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const OPENED_AT = Date.parse("2026-10-28T12:00:00.000Z");

class FixedClock extends Clock {
  override now(): number {
    return OPENED_AT;
  }
}

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

const seedFreeTable = async (
  repository: MemoryDiningRoom,
): Promise<DiningTable> => {
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  await repository.save(table);

  return table;
};

it("given a free table, when opened for 4, then it is occupied with an empty check", async () => {
  const repository = new MemoryDiningRoom();
  const openTable = new OpenTable(repository, new FixedClock());
  await seedFreeTable(repository);

  const opened = await openTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    checkId: CHECK_ID,
    diners: 4,
  });

  expect(opened.table.state).toBe("occupied");
  expect(opened.table.diners).toBe(4);
  expect(opened.table.zone).toBe("Terrace");
  expect(opened.check.id).toBe(CHECK_ID);
  expect(opened.check.tableId).toBe(TABLE_ID);
  expect(opened.check.openedAt).toBe("2026-10-28T12:00:00.000Z");
  expect(opened.check.total).toBe(0);
  expect(opened.check.orders).toEqual([]);
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("occupied");
  expect(stored?.diners).toBe(4);
});

it("given an occupied table, when opened, then the account is kept", async () => {
  const repository = new MemoryDiningRoom();
  const openTable = new OpenTable(repository, new FixedClock());
  await seedFreeTable(repository);
  const opened = await openTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    checkId: CHECK_ID,
    diners: 4,
  });
  opened.check.addLine({
    orderId: "order_1",
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  opened.check.send({
    course: 1,
    sentAt: "2026-10-28T12:03:10.000Z",
  });
  const save = vi.spyOn(repository, "save");

  const openAgain = openTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    checkId: "check_6",
    diners: 2,
  });

  await expect(openAgain).rejects.toThrow(TableAlreadyOccupied);
  expect(save).not.toHaveBeenCalled();
  expect(opened.check.id).toBe(CHECK_ID);
  expect(opened.check.total).toBe(12_000);
  expect(opened.check.orders[0]?.lines[0]?.name).toBe("Soup");
  expect(opened.check.orders[0]?.lines[0]?.price).toBe(12_000);
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("occupied");
  expect(stored?.diners).toBe(4);
});

it("given a rejection, when a table is opened, then nothing is saved", async () => {
  const repository = new MemoryDiningRoom();
  const openTable = new OpenTable(repository, new FixedClock());
  await seedFreeTable(repository);
  const save = vi.spyOn(repository, "save");

  const open = openTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    checkId: "5",
    diners: 4,
  });

  await expect(open).rejects.toThrow(InvalidCheckId);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("free");
  expect(stored?.diners).toBe(0);
});
