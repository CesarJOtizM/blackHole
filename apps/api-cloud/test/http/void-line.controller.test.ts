import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import {
  type OpenShiftQuery,
  OpenShiftReader,
} from "@blackhole/orders/application/entry-port";
import { expect, it } from "vitest";

import {
  routePermissions,
  VoidLineController,
} from "#src/http/void-line.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  postDining,
  seatOccupiedCheck,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const orderId = "order_1";
const lineId = "line_soup";
const linePrice = 22_000;
const shiftId = "shift_1";
const reason = "Guest sent the soup back";
const waiterId = "user_waiter";
const lineUrl = diningPath(`checks/${checkId}/lines/${lineId}/void`);

const command = {
  reason,
  shiftId,
  authorizationId: null,
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

const storedLineIds = async (diningRooms: InMemoryDiningRoomRepository) => {
  const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

  return (
    stored?.orders.flatMap((order) => order.lines.map((line) => line.id)) ?? []
  );
};

it("given a kitchen chief session and an open shift, when POST /checks/:checkId/lines/:lineId/void is injected, then the response is 200, the line stays, and no void is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/lines/:lineId/void": "sale.void-before-kitchen",
    });
    expect(application.get(VoidLineController)).toBeInstanceOf(
      VoidLineController,
    );
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      lineUrl,
      "session_kitchen",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLineIds(diningRooms)).toEqual([lineId]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a waiter session inside the before-kitchen cap and an open shift, when POST /checks/:checkId/lines/:lineId/void is injected, then the line leaves and the audit records the void", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
    people: [[waiterId, "session_waiter", "waiter"]],
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      lineUrl,
      "session_waiter",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [] });
    expect(await storedLineIds(diningRooms)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.void-before-kitchen",
        actorId: waiterId,
        authorizerId: null,
        reason,
        after: expect.objectContaining({ value: 1, shiftId }),
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given an open check, when POST /checks/:checkId/lines/:lineId/void omits x-session-id, then the response is 400 and the line stays", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await holdSoup(diningRooms);

    const response = await application.inject({
      method: "POST",
      url: lineUrl,
      payload: command,
    });

    expect(response.statusCode).toBe(400);
    expect(await storedLineIds(diningRooms)).toEqual([lineId]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open check, when POST /checks/:checkId/lines/:lineId/void sends an unknown session, then the response is 400 and the line stays", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      lineUrl,
      "session_missing",
      command,
    );

    expect(response.statusCode).toBe(400);
    expect(await storedLineIds(diningRooms)).toEqual([lineId]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
