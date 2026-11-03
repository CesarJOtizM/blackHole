import { expect, it } from "vitest";
import {
  RequestCheckController,
  routePermissions,
} from "#src/http/request-check.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  openedAt,
  ownerId,
  placeFreeTable,
  postDining,
  seatOccupiedCheck,
  tableId,
  tenantId,
  venueId,
  WatchingOrdersPrinter,
} from "#test/http/dining-room-session.js";

const billUrl = diningPath(`checks/${checkId}/bill`);

it("given an occupied check, when POST /checks/:checkId/bill is injected, then the response is 200, the bill is requested, and the audit records the bill", async () => {
  const printer = new WatchingOrdersPrinter();
  const { application, diningRooms, audits } = await openDiningCloud({
    printer,
  });

  try {
    expect(routePermissions["POST checks/:checkId/bill"]).toBe(
      "sale.open-table",
    );
    expect(application.get(RequestCheckController)).toBeInstanceOf(
      RequestCheckController,
    );
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(
      application,
      billUrl,
      "session_owner",
      {},
    );
    const storedTable = await diningRooms.load(tenantId, venueId, tableId);
    const storedCheck = await diningRooms.loadCheck(tenantId, venueId, checkId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: checkId,
      tenantId,
      venueId,
      tableId,
      state: "check_requested",
      preBillRequestedAt: openedAt,
      printed: false,
    });
    expect(printer.queued).toEqual([{ status: "waiting", kickDrawer: false }]);
    expect(printer.jobs).toEqual([
      expect.objectContaining({
        document: "pre_bill",
        kickDrawer: false,
      }),
    ]);
    expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
    expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
    expect(storedTable?.state).toBe("check_requested");
    expect(storedCheck?.tableState).toBe("check_requested");
    expect(storedCheck?.preBillRequest).toEqual({ requestedAt: openedAt });
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "sale.open-table",
        entity: checkId,
        before: { state: "occupied" },
        after: { state: "check_requested", preBillRequestedAt: openedAt },
        reason: "sale.open-table",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/:checkId/bill is injected, then the response is 403, the check stays occupied, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(
      application,
      billUrl,
      "session_kitchen",
      {},
    );
    const storedTable = await diningRooms.load(tenantId, venueId, tableId);
    const storedCheck = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(storedTable?.state).toBe("occupied");
    expect(storedCheck?.tableState).toBe("occupied");
    expect(storedCheck?.preBillRequest).toBeUndefined();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/:checkId/bill sends a client timestamp, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, billUrl, "session_owner", {
      occurredAt: openedAt,
    });
    const storedTable = await diningRooms.load(tenantId, venueId, tableId);
    const storedCheck = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(400);
    expect(storedTable?.state).toBe("occupied");
    expect(storedCheck?.tableState).toBe("occupied");
    expect(storedCheck?.preBillRequest).toBeUndefined();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given no check, when POST /checks/:checkId/bill is injected, then the response is 409 and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await placeFreeTable(diningRooms);

    const response = await postDining(
      application,
      billUrl,
      "session_owner",
      {},
    );
    const storedTable = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "TableNotOpen" });
    expect(storedTable?.state).toBe("free");
    expect(await diningRooms.loadCheck(tenantId, venueId, checkId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
