import { expect, it, vi } from "vitest";

import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
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

  return {
    dining,
    requestCheck: new RequestCheck(dining, new FixedClock()),
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
    const { dining, requestCheck } = await seat({
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
  }
});
