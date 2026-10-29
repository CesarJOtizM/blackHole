import { expect, it } from "vitest";
import {
  OpenTableController,
  routePermissions,
} from "#src/http/open-table.controller.js";
import {
  checkId,
  diningPath,
  occupyTable,
  openDiningCloud,
  openedAt,
  ownerId,
  placeFreeTable,
  postDining,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const openBody = {
  checkId,
  diners: 4,
};

const openUrl = diningPath(`dining-tables/${tableId}/open`);

it("given an owner session and a free table, when POST /dining-tables/:tableId/open seats 4, then the response is 200, the table is occupied, and the audit records the open", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions["POST dining-tables/:tableId/open"]).toBe(
      "sale.open-table",
    );
    expect(application.get(OpenTableController)).toBeInstanceOf(
      OpenTableController,
    );
    await placeFreeTable(diningRooms);

    const response = await postDining(
      application,
      openUrl,
      "session_owner",
      openBody,
    );
    const stored = await diningRooms.load(tenantId, venueId, tableId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: tableId,
      tenantId,
      venueId,
      zone: "Terrace",
      state: "occupied",
      diners: 4,
      checkId,
      openedAt,
    });
    expect(stored?.state).toBe("occupied");
    expect(stored?.diners).toBe(4);
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "sale.open-table",
        entity: tableId,
        before: { state: "free", diners: 0 },
        after: { state: "occupied", diners: 4, checkId },
        reason: "sale.open-table",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /dining-tables/:tableId/open is injected, then the response is 403, the table stays free, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await placeFreeTable(diningRooms);

    const response = await postDining(
      application,
      openUrl,
      "session_kitchen",
      openBody,
    );
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(stored?.state).toBe("free");
    expect(stored?.diners).toBe(0);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /dining-tables/:tableId/open sends a bad body, then the response is 400, the table stays free, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await placeFreeTable(diningRooms);

    const missing = await postDining(application, openUrl, "session_owner", {});
    const stamped = await postDining(application, openUrl, "session_owner", {
      ...openBody,
      occurredAt: openedAt,
    });
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(missing.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(stored?.state).toBe("free");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an occupied table, when POST /dining-tables/:tableId/open is injected, then the response is 409, the account is kept, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await occupyTable(diningRooms);

    const response = await postDining(
      application,
      openUrl,
      "session_owner",
      openBody,
    );
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "TableAlreadyOccupied" });
    expect(stored?.state).toBe("occupied");
    expect(stored?.diners).toBe(4);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a free table, when the check id is rejected, then the response is 409, the table stays free, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await placeFreeTable(diningRooms);

    const response = await postDining(application, openUrl, "session_owner", {
      checkId: "5",
      diners: 4,
    });
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "InvalidCheckId" });
    expect(stored?.state).toBe("free");
    expect(stored?.diners).toBe(0);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
