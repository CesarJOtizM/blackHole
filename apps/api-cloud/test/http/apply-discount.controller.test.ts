import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import {
  type OpenShiftQuery,
  OpenShiftReader,
} from "@blackhole/orders/application/entry-port";
import { expect, it } from "vitest";

import {
  ApplyDiscountController,
  routePermissions,
} from "#src/http/apply-discount.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  ownerId,
  postDining,
  seatOccupiedCheck,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const orderId = "order_1";
const lineId = "line_soup";
const linePrice = 22_000;
const shiftId = "shift_1";
const reason = "Regular guest";
const percent = 10;
const discountUrl = diningPath(`checks/${checkId}/discount`);

const command = {
  reason,
  shiftId,
  authorizationId: null,
  percent,
};

class OpenCloudShift extends OpenShiftReader {
  override isOpen(_query: OpenShiftQuery): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const holdSoup = async (diningRooms: InMemoryDiningRoomRepository) => {
  const check = await seatOccupiedCheck(diningRooms);

  check.addLine({
    orderId,
    lineId,
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: linePrice,
    channel: "waiter",
  });
  await diningRooms.saveCheck(check);
};

const storedLinePrices = async (diningRooms: InMemoryDiningRoomRepository) => {
  const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

  return (
    stored?.orders.flatMap((order) => order.lines.map((line) => line.price)) ??
    []
  );
};

it("given a kitchen chief session and an open shift, when POST /checks/:checkId/discount is injected, then the response is 200, the line price stays, and no discount is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/discount": "sale.discount",
    });
    expect(application.get(ApplyDiscountController)).toBeInstanceOf(
      ApplyDiscountController,
    );
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      discountUrl,
      "session_kitchen",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLinePrices(diningRooms)).toEqual([linePrice]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session and an open shift, when POST /checks/:checkId/discount is injected, then the line price stays and the audit records the percent", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      discountUrl,
      "session_owner",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLinePrices(diningRooms)).toEqual([linePrice]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.discount",
        actorId: ownerId,
        authorizerId: null,
        reason,
        after: { value: percent, shiftId, kitchen: null },
      }),
    ]);
  } finally {
    await application.close();
  }
});
