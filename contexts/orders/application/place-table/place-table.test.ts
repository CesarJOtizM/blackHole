import { expect, it, vi } from "vitest";

import { PlaceTable } from "#application/place-table/place-table.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { Check } from "#domain/check.js";
import { type DiningTable, InvalidTableId } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";

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

it("given a venue, when a table is placed in Terrace, then the zone is kept", async () => {
  const repository = new MemoryDiningRoom();
  const placeTable = new PlaceTable(repository);

  const table = await placeTable.execute({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(table.zone).toBe("Terrace");
  expect(table.venueId).toBe(VENUE_ID);
  expect(table.state).toBe("free");
  expect(stored?.zone).toBe("Terrace");
  expect(stored?.id).toBe(TABLE_ID);
  expect(stored?.state).toBe("free");
});

it("given a rejection, when a table is placed, then nothing is saved", async () => {
  const repository = new MemoryDiningRoom();
  const placeTable = new PlaceTable(repository);
  await placeTable.execute({
    id: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });
  const save = vi.spyOn(repository, "save");

  const place = placeTable.execute({
    id: "5",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  await expect(place).rejects.toThrow(InvalidTableId);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, TABLE_ID);
  expect(stored?.zone).toBe("Terrace");
  expect(await repository.load(TENANT_ID, VENUE_ID, "5")).toBeNull();
});
