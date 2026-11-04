import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import {
  type OpenShiftQuery,
  OpenShiftReader,
} from "@blackhole/orders/application/entry-port";
import { expect, it } from "vitest";

import {
  ApplyCourtesyController,
  routePermissions,
} from "#src/http/apply-courtesy.controller.js";
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
const reason = "Spilled at the table";
const courtesyCop = 15_000;
const courtesyUrl = diningPath(`checks/${checkId}/courtesy`);

const command = {
  reason,
  shiftId,
  authorizationId: null,
  value: courtesyCop,
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

it("given a kitchen chief session and an open shift, when POST /checks/:checkId/courtesy is injected, then the response is 200, the line price stays, and no courtesy is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/courtesy": "sale.comp",
    });
    expect(application.get(ApplyCourtesyController)).toBeInstanceOf(
      ApplyCourtesyController,
    );
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      courtesyUrl,
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

it("given an owner session and an open shift, when POST /checks/:checkId/courtesy is injected, then the line price stays and the audit records the courtesy amount", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      courtesyUrl,
      "session_owner",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLinePrices(diningRooms)).toEqual([linePrice]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.comp",
        actorId: ownerId,
        authorizerId: null,
        reason,
        after: { value: courtesyCop, shiftId, kitchen: null },
      }),
    ]);
  } finally {
    await application.close();
  }
});
