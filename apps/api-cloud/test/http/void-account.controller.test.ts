import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import {
  type OpenShiftQuery,
  OpenShiftReader,
} from "@blackhole/orders/application/entry-port";
import type { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { PERMISSION } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  routePermissions,
  VoidAccountController,
} from "#src/http/void-account.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  openedAt,
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
const reason = "Guest walked out";
const cashierId = "user_cashier";
const authorizationId = "request_void_account";
const accountUrl = diningPath(`checks/${checkId}/void`);

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

const approveAccountVoid = async (
  authorizations: InMemoryAuthorizationRepository,
) => {
  const authorization = await authorizations.load(tenantId);

  if (!authorization) {
    throw new Error("The tenant authorization is missing.");
  }

  const before = authorization.snapshot();

  authorization.requestAuthorization({
    requestId: authorizationId,
    requesterId: cashierId,
    permission: PERMISSION.SALE_VOID_ACCOUNT,
    venueId,
    targetId: checkId,
    value: linePrice,
    reason,
    expiresAt: Date.parse(openedAt) + 3_600_000,
  });
  authorization.resolveAuthorization({
    requestId: authorizationId,
    authorizerId: ownerId,
    deviceId: "device_owner",
    shiftId,
    at: Date.parse(openedAt),
    approved: true,
    authorizerAssignmentCount: 1,
  });
  await authorizations.save(authorization, {
    before,
    after: authorization.snapshot(),
  });
};

it("given a kitchen chief session and an open shift, when POST /checks/:checkId/void is injected, then the response is 200, the lines stay, and no void is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/void": "sale.void-account",
    });
    expect(application.get(VoidAccountController)).toBeInstanceOf(
      VoidAccountController,
    );
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      accountUrl,
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

it("given a cashier session, an open shift, and a matching grant, when POST /checks/:checkId/void is injected, then the account is cleared and the audit records the grant authorizer", async () => {
  const { application, diningRooms, audits, authorizations } =
    await openDiningCloud({
      shifts: new OpenCloudShift(),
      people: [
        [ownerId, "session_owner", "owner"],
        [cashierId, "session_cashier", "cashier"],
      ],
    });

  try {
    await holdSoup(diningRooms);
    await approveAccountVoid(authorizations);

    const response = await postDining(
      application,
      accountUrl,
      "session_cashier",
      { ...command, authorizationId },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [] });
    expect(await storedLineIds(diningRooms)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.void-account",
        actorId: cashierId,
        authorizerId: ownerId,
        reason,
        after: expect.objectContaining({ value: linePrice, shiftId }),
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given an owner session and an open shift, when POST /checks/:checkId/void sends authorizerId or shift totals, then the response is 400 and the lines stay", async () => {
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      accountUrl,
      "session_owner",
      {
        ...command,
        authorizerId: ownerId,
        shiftTotals: { waiterVoidsBeforeKitchen: 2, compShiftCop: 90_000 },
      },
    );

    expect(response.statusCode).toBe(400);
    expect(await storedLineIds(diningRooms)).toEqual([lineId]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open check, when POST /checks/:checkId/void omits x-session-id, then the response is 400 and the lines stay", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await holdSoup(diningRooms);

    const response = await application.inject({
      method: "POST",
      url: accountUrl,
      payload: command,
    });

    expect(response.statusCode).toBe(400);
    expect(await storedLineIds(diningRooms)).toEqual([lineId]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
