import { expect, it, vi } from "vitest";

import { MarkAccountPaid } from "#application/mark-account-paid/mark-account-paid.js";
import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import { DiningTable, TableAlreadyOccupied } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";

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

  override async loadOpenCheckByTable(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<Check | null> {
    return (
      [...this.checks.values()].find(
        (check) =>
          check.tenantId === tenantId &&
          check.venueId === venueId &&
          check.tableId === tableId &&
          (check.tableState === "occupied" ||
            check.tableState === "check_requested"),
      ) ?? null
    );
  }
}

class FixedClock extends Clock {
  override now(): number {
    return Date.parse("2026-10-29T19:00:00.000Z");
  }
}

const seedTable = async (
  repository: MemoryDiningRoom,
  prepare?: (table: DiningTable) => void,
): Promise<void> => {
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  prepare?.(table);
  await repository.save(table);
};

const seedCheck = async (repository: MemoryDiningRoom): Promise<void> => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: "2026-10-29T18:00:00.000Z",
  });

  check.addLine({
    orderId: "order_1",
    lineId: "line_1",
    productId: "menu_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  await repository.saveCheck(check);
};

const checkSnapshot = (check: Check) => ({
  tableId: check.tableId,
  tableState: check.tableState,
  lineId: check.orders[0]?.lines[0]?.id,
  originTableId: check.orders[0]?.lines[0]?.originTableId,
});

it("given an occupied table, when the account is marked paid, then the table is to_clean", async () => {
  const repository = new MemoryDiningRoom();
  const markAccountPaid = new MarkAccountPaid(repository, new FixedClock());
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
  });
  await seedCheck(repository);
  const before = checkSnapshot(
    (await repository.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID)) as Check,
  );
  const save = vi.spyOn(repository, "save");
  const saveCheck = vi.spyOn(repository, "saveCheck");
  const saveChecks = vi.spyOn(repository, "saveChecks");

  const paid = await markAccountPaid.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(paid.state).toBe("to_clean");
  expect(paid.diners).toBe(4);
  expect(save).toHaveBeenCalledTimes(1);
  expect(saveCheck).toHaveBeenCalledTimes(1);
  expect(saveChecks).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("to_clean");
  expect(stored?.zone).toBe("Terrace");
  const storedCheck = await repository.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(checkSnapshot(storedCheck as Check)).toEqual(before);
  expect(storedCheck?.chargedAt).toBe("2026-10-29T19:00:00.000Z");
});

it("given a check-requested table, when the account is marked paid, then the table is to_clean", async () => {
  const repository = new MemoryDiningRoom();
  const markAccountPaid = new MarkAccountPaid(repository);
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
    table.requestCheck();
  });
  const save = vi.spyOn(repository, "save");

  const paid = await markAccountPaid.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(paid.state).toBe("to_clean");
  expect(paid.diners).toBe(4);
  expect(save).toHaveBeenCalledTimes(1);
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("to_clean");
});

it("given a paid table, when the account is marked paid again, then it stays to_clean", async () => {
  const repository = new MemoryDiningRoom();
  const markAccountPaid = new MarkAccountPaid(repository);
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
  });

  const first = await markAccountPaid.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(first.state).toBe("to_clean");
  const save = vi.spyOn(repository, "save");

  const second = await markAccountPaid.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(second.state).toBe("to_clean");
  expect(second.diners).toBe(4);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("to_clean");
  expect(stored?.diners).toBe(4);
});

it("given a free table, when the account is marked paid, then it is rejected and nothing is saved", async () => {
  const repository = new MemoryDiningRoom();
  const markAccountPaid = new MarkAccountPaid(repository);
  await seedTable(repository);
  const save = vi.spyOn(repository, "save");
  const saveCheck = vi.spyOn(repository, "saveCheck");

  const paid = markAccountPaid.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  await expect(paid).rejects.toThrow(TableAlreadyOccupied);
  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("free");
  expect(stored?.diners).toBe(0);
});
