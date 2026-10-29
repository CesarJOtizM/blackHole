import { expect, it, vi } from "vitest";

import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { ViewTableMap } from "#application/view-table-map/view-table-map.js";
import type { Check } from "#domain/check.js";
import { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly tables: DiningTable[] = [];

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    return (
      this.tables.find(
        (table) =>
          table.tenantId === tenantId &&
          table.venueId === venueId &&
          table.id === tableId,
      ) ?? null
    );
  }

  override async save(table: DiningTable): Promise<void> {
    this.tables.push(table);
  }

  override async loadCheck(
    _tenantId: string,
    _venueId: string,
    _checkId: string,
  ): Promise<Check | null> {
    return null;
  }

  override async saveCheck(_check: Check): Promise<void> {}

  override async saveChecks(_checks: readonly Check[]): Promise<void> {}

  override async listTables(
    tenantId: string,
    venueId: string,
  ): Promise<readonly DiningTable[]> {
    return this.tables.filter(
      (table) => table.tenantId === tenantId && table.venueId === venueId,
    );
  }
}

const place = async (
  dining: MemoryDiningRoom,
  input: {
    id: string;
    tenantId: string;
    venueId: string;
    zone: string;
    diners?: number;
  },
): Promise<void> => {
  const table = DiningTable.place(input);

  if (input.diners !== undefined) {
    table.open({ diners: input.diners });
  }

  await dining.save(table);
};

it("given zones, when the map is read, then the tables are grouped by zone", async () => {
  const dining = new MemoryDiningRoom();
  const view = new ViewTableMap(dining);
  await place(dining, {
    id: "table_6",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });
  await place(dining, {
    id: "table_7",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Bar",
  });
  await place(dining, {
    id: "table_5",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
    diners: 4,
  });
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  const map = await view.execute({ tenantId: TENANT_ID, venueId: VENUE_ID });

  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
  expect(map.zones).toEqual([
    {
      zone: "Bar",
      tables: [{ id: "table_7", state: "free", diners: 0 }],
    },
    {
      zone: "Terrace",
      tables: [
        { id: "table_5", state: "occupied", diners: 4 },
        { id: "table_6", state: "free", diners: 0 },
      ],
    },
  ]);
});

it("given another tenant, when the map is read, then that tenant stays hidden", async () => {
  const dining = new MemoryDiningRoom();
  const view = new ViewTableMap(dining);
  await place(dining, {
    id: "table_5",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
    diners: 4,
  });
  await place(dining, {
    id: "table_8",
    tenantId: OTHER_TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });
  await place(dining, {
    id: "table_9",
    tenantId: TENANT_ID,
    venueId: OTHER_VENUE_ID,
    zone: "Terrace",
  });
  const listTables = vi.spyOn(dining, "listTables");
  const save = vi.spyOn(dining, "save");

  const map = await view.execute({ tenantId: TENANT_ID, venueId: VENUE_ID });

  expect(listTables).toHaveBeenCalledWith(TENANT_ID, VENUE_ID);
  expect(save).not.toHaveBeenCalled();
  expect(map.zones).toEqual([
    {
      zone: "Terrace",
      tables: [{ id: "table_5", state: "occupied", diners: 4 }],
    },
  ]);
});
