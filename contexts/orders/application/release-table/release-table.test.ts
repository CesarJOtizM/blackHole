import { expect, it, vi } from "vitest";

import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  MarkTableReady,
  ReleaseTable,
} from "#application/release-table/release-table.js";
import { Check } from "#domain/check.js";
import { DiningTable, TableAlreadyOccupied } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const RELEASED_AT = Date.parse("2026-10-28T14:00:00.000Z");

class FixedClock extends Clock {
  override now(): number {
    return RELEASED_AT;
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

  override async loadOpenCheckByTable(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<Check | null> {
    for (const check of this.checks.values()) {
      if (
        check.tenantId === tenantId &&
        check.venueId === venueId &&
        check.tableId === tableId &&
        check.releasedAt === undefined
      ) {
        return check;
      }
    }

    return null;
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

it("given an occupied table with an open check, when released, then the check stamps releasedAt", async () => {
  const repository = new MemoryDiningRoom();
  const releaseTable = new ReleaseTable(repository, new FixedClock());
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
  });
  await repository.saveCheck(
    Check.open({
      id: CHECK_ID,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      tableId: TABLE_ID,
      openedAt: "2026-10-28T12:00:00.000Z",
      diners: 4,
    }),
  );

  const released = await releaseTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(released.state).toBe("to_clean");
  const stored = await repository.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.releasedAt).toBe("2026-10-28T14:00:00.000Z");
});

it("given an occupied table, when released, then the table is to_clean", async () => {
  const repository = new MemoryDiningRoom();
  const releaseTable = new ReleaseTable(repository);
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
  });

  const released = await releaseTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(released.state).toBe("to_clean");
  expect(released.diners).toBe(4);
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("to_clean");
  expect(stored?.zone).toBe("Terrace");
});

it("given a table to clean, when marked ready, then the table is free", async () => {
  const repository = new MemoryDiningRoom();
  const markTableReady = new MarkTableReady(repository);
  await seedTable(repository, (table) => {
    table.open({ diners: 4 });
    table.release();
  });

  const ready = await markTableReady.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  expect(ready.state).toBe("free");
  expect(ready.diners).toBe(0);
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("free");
  expect(stored?.diners).toBe(0);
});

it("given a rejection, when a table is released, then nothing is saved", async () => {
  const repository = new MemoryDiningRoom();
  const releaseTable = new ReleaseTable(repository);
  await seedTable(repository);
  const save = vi.spyOn(repository, "save");

  const release = releaseTable.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });

  await expect(release).rejects.toThrow(TableAlreadyOccupied);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.state).toBe("free");
});
