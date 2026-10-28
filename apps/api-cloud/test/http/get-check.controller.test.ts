import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { Check, DiningTable } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  GetCheckController,
  routePermissions,
} from "#src/http/get-check.controller.js";
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

const accountUrl = diningPath(`checks/${checkId}`);
const orderId = "order_1";
const soupId = "menu_product_soup";
const steakId = "menu_product_steak";
const sentAt = "2026-10-28T12:00:00.000Z";

const seatAccount = async (diningRooms: InMemoryDiningRoomRepository) => {
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
    lineId: "line_soup",
    productId: soupId,
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.addLine({
    orderId,
    lineId: "line_steak",
    productId: steakId,
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt });
  await diningRooms.saveCheck(check);
};

it("given a check and a kitchen chief session, when GET /checks/:checkId is injected, then the response is 200 and the account is shown", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "GET checks/:checkId": "session",
    });
    expect(application.get(GetCheckController)).toBeInstanceOf(
      GetCheckController,
    );
    await seatAccount(diningRooms);

    const response = await getDining(application, accountUrl, "session_kitchen");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checkId,
      tableId,
      tenantId,
      venueId,
      lineIds: ["line_soup", "line_steak"],
      total: 12_000,
      orders: [
        {
          id: orderId,
          channel: "waiter",
          lines: [
            {
              id: "line_soup",
              productId: soupId,
              name: "Soup",
              course: 1,
              price: 12_000,
              state: "sent",
              sentAt,
              originTableId: tableId,
            },
            {
              id: "line_steak",
              productId: steakId,
              name: "Steak",
              course: 2,
              price: 45_000,
              state: "held",
              originTableId: tableId,
            },
          ],
        },
      ],
    });
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
