import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { DiningTable } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  routePermissions,
  ViewTableMapController,
} from "#src/http/view-table-map.controller.js";
import {
  diningPath,
  getDining,
  openDiningCloud,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const mapUrl = diningPath("table-map");
const barTableId = "table_7";

const placeTables = async (diningRooms: InMemoryDiningRoomRepository) => {
  const terrace = DiningTable.place({
    id: tableId,
    tenantId,
    venueId,
    zone: "Terrace",
  });
  const bar = DiningTable.place({
    id: barTableId,
    tenantId,
    venueId,
    zone: "Bar",
  });

  terrace.open({ diners: 4 });
  await diningRooms.save(terrace);
  await diningRooms.save(bar);
};

it("given zones and a kitchen chief session, when GET /table-map is injected, then the response is 200 and the map is grouped without sale.open-table", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "GET table-map": "session",
    });
    expect(application.get(ViewTableMapController)).toBeInstanceOf(
      ViewTableMapController,
    );
    await placeTables(diningRooms);

    const response = await getDining(application, mapUrl, "session_kitchen");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      zones: [
        {
          zone: "Bar",
          tables: [{ id: barTableId, state: "free", diners: 0 }],
        },
        {
          zone: "Terrace",
          tables: [{ id: tableId, state: "occupied", diners: 4 }],
        },
      ],
    });
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when GET /table-map omits x-session-id, then the response is 400", async () => {
  const { application, audits } = await openDiningCloud();

  try {
    const response = await application.inject({
      method: "GET",
      url: mapUrl,
    });

    expect(response.statusCode).toBe(400);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
