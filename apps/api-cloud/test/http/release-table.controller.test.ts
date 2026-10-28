import { expect, it } from "vitest";
import {
  ReleaseTableController,
  routePermissions,
} from "#src/http/release-table.controller.js";
import {
  diningPath,
  markTableToClean,
  occupyTable,
  openDiningCloud,
  openedAt,
  placeFreeTable,
  postDining,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const releaseUrl = diningPath(`dining-tables/${tableId}/release`);
const readyUrl = diningPath(`dining-tables/${tableId}/ready`);

it("given an occupied table, when POST /dining-tables/:tableId/release is injected, then the response is 200, the table is to clean, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions["POST dining-tables/:tableId/release"]).toBe(
      "sale.open-table",
    );
    expect(routePermissions["POST dining-tables/:tableId/ready"]).toBe(
      "sale.open-table",
    );
    expect(application.get(ReleaseTableController)).toBeInstanceOf(
      ReleaseTableController,
    );
    await occupyTable(diningRooms);

    const response = await postDining(
      application,
      releaseUrl,
      "session_owner",
      {},
    );
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: tableId,
      tenantId,
      venueId,
      zone: "Terrace",
      state: "to_clean",
      diners: 4,
    });
    expect(stored?.state).toBe("to_clean");
    expect(stored?.diners).toBe(4);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a table to clean, when POST /dining-tables/:tableId/ready is injected, then the response is 200, the table is free, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await markTableToClean(diningRooms);

    const response = await postDining(
      application,
      readyUrl,
      "session_owner",
      {},
    );
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: tableId,
      tenantId,
      venueId,
      zone: "Terrace",
      state: "free",
      diners: 0,
    });
    expect(stored?.state).toBe("free");
    expect(stored?.diners).toBe(0);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when release and ready are injected, then the response is 403 and the table is unchanged", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await occupyTable(diningRooms);

    const release = await postDining(
      application,
      releaseUrl,
      "session_kitchen",
      {},
    );
    const occupied = await diningRooms.load(tenantId, venueId, tableId);

    expect(release.statusCode).toBe(403);
    expect(release.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(occupied?.state).toBe("occupied");

    await markTableToClean(diningRooms);
    const ready = await postDining(
      application,
      readyUrl,
      "session_kitchen",
      {},
    );
    const cleaning = await diningRooms.load(tenantId, venueId, tableId);

    expect(ready.statusCode).toBe(403);
    expect(ready.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(cleaning?.state).toBe("to_clean");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when release or ready sends a client timestamp, then the response is 400 and the table is unchanged", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await occupyTable(diningRooms);

    const release = await postDining(application, releaseUrl, "session_owner", {
      occurredAt: openedAt,
    });
    const occupied = await diningRooms.load(tenantId, venueId, tableId);

    expect(release.statusCode).toBe(400);
    expect(occupied?.state).toBe("occupied");

    await markTableToClean(diningRooms);
    const ready = await postDining(application, readyUrl, "session_owner", {
      occurredAt: openedAt,
    });
    const cleaning = await diningRooms.load(tenantId, venueId, tableId);

    expect(ready.statusCode).toBe(400);
    expect(cleaning?.state).toBe("to_clean");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a free table, when release or ready is injected, then the response is 409 and the table stays free", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await placeFreeTable(diningRooms);

    const release = await postDining(
      application,
      releaseUrl,
      "session_owner",
      {},
    );
    const afterRelease = await diningRooms.load(tenantId, venueId, tableId);
    const ready = await postDining(application, readyUrl, "session_owner", {});
    const afterReady = await diningRooms.load(tenantId, venueId, tableId);

    expect(release.statusCode).toBe(409);
    expect(release.json()).toEqual({ error: "TableAlreadyOccupied" });
    expect(afterRelease?.state).toBe("free");
    expect(ready.statusCode).toBe(409);
    expect(ready.json()).toEqual({ error: "TableAlreadyOccupied" });
    expect(afterReady?.state).toBe("free");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
