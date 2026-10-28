import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { Check, DiningTable } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  routePermissions,
  ViewStationQueueController,
} from "#src/http/view-station-queue.controller.js";
import {
  checkId,
  diningPath,
  getDining,
  openDiningCloud,
  openedAt,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const stationId = "station_grill";
const queueUrl = diningPath(`stations/${stationId}/queue`);
const orderId = "order_1";
const soupId = "menu_product_soup";
const steakId = "menu_product_steak";
const saladId = "menu_product_salad";
const at1200 = "2026-10-28T12:00:00.000Z";
const at1202 = "2026-10-28T12:02:00.000Z";

const seatQueue = async (diningRooms: InMemoryDiningRoomRepository) => {
  const table = DiningTable.place({
    id: tableId,
    tenantId,
    venueId,
    zone: "Terrace",
  });

  table.open({ diners: 4 });
  await diningRooms.save(table);

  const check = Check.open({
    id: checkId,
    tenantId,
    venueId,
    tableId,
    openedAt,
  });

  check.addLine({
    orderId,
    lineId: "line_later",
    productId: steakId,
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.addLine({
    orderId,
    lineId: "line_noon",
    productId: soupId,
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.addLine({
    orderId,
    lineId: "line_held",
    productId: saladId,
    name: "Salad",
    course: 3,
    price: 8_000,
    channel: "waiter",
  });
  check.send({ course: 2, sentAt: at1202 });
  check.send({ course: 1, sentAt: at1200 });
  await diningRooms.saveCheck(check);
};

it("given lines sent at 12:00 and 12:02 and a kitchen chief session, when GET /stations/:stationId/queue is injected, then the response is 200, 12:00 is first, and the held line stays off the queue", async () => {
  const stationRoutes = new InMemoryStationRouteRepository();

  await stationRoutes.save({
    tenantId,
    venueId,
    stationId,
    stationName: "Grill",
    productId: soupId,
    output: "screen",
    redThresholdMinutes: 15,
  });
  await stationRoutes.save({
    tenantId,
    venueId,
    stationId,
    stationName: "Grill",
    productId: steakId,
    output: "both",
    redThresholdMinutes: 15,
  });
  await stationRoutes.save({
    tenantId,
    venueId,
    stationId,
    stationName: "Grill",
    productId: saladId,
    output: "screen",
    redThresholdMinutes: 15,
  });

  const { application, diningRooms, audits } = await openDiningCloud({
    stationRoutes,
  });

  try {
    expect(routePermissions).toEqual({
      "GET stations/:stationId/queue": "session",
    });
    expect(application.get(ViewStationQueueController)).toBeInstanceOf(
      ViewStationQueueController,
    );
    await seatQueue(diningRooms);

    const response = await getDining(application, queueUrl, "session_kitchen");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      stationId,
      lines: [
        {
          checkId,
          tableId,
          lineId: "line_noon",
          productId: soupId,
          name: "Soup",
          sentAt: at1200,
          state: "sent",
          color: "green",
        },
        {
          checkId,
          tableId,
          lineId: "line_later",
          productId: steakId,
          name: "Steak",
          sentAt: at1202,
          state: "sent",
          color: "green",
        },
      ],
    });
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
