import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { Check, DiningTable } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  ChangeLineStateController,
  routePermissions,
} from "#src/http/change-line-state.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  openedAt,
  postDining,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const orderId = "order_1";
const lineId = "line_soup";
const soupId = "menu_product_soup";
const soupPrice = 22_000;
const sentAt = "2026-10-28T12:03:10.000Z";
const preparedAt = "2026-10-28T12:05:00.000Z";
const readyAt = "2026-10-28T12:11:00.000Z";
const preparationUrl = diningPath(
  `checks/${checkId}/lines/${lineId}/preparation`,
);
const readyUrl = diningPath(`checks/${checkId}/lines/${lineId}/ready`);

const preparedSoup = {
  id: lineId,
  orderId,
  checkId,
  productId: soupId,
  name: "Soup",
  course: 1,
  price: soupPrice,
  state: "in_preparation",
  channel: "waiter",
  sentAt,
  inPreparationAt: openedAt,
};

const seatSoup = async (
  diningRooms: InMemoryDiningRoomRepository,
  state: "sent" | "in_preparation" | "ready",
) => {
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
    lineId,
    productId: soupId,
    name: "Soup",
    course: 1,
    price: soupPrice,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt });

  if (state === "in_preparation" || state === "ready") {
    check.advance({ lineId, state: "in_preparation", at: preparedAt });
  }

  if (state === "ready") {
    check.advance({ lineId, state: "ready", at: readyAt });
  }

  await diningRooms.saveCheck(check);
};

const storedLine = async (diningRooms: InMemoryDiningRoomRepository) => {
  const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

  return stored?.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);
};

it("given a sent line and a kitchen chief session, when POST /lines/:lineId/preparation is injected, then the response is 200, the line is in preparation, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/lines/:lineId/preparation": "session",
      "POST checks/:checkId/lines/:lineId/ready": "session",
    });
    expect(application.get(ChangeLineStateController)).toBeInstanceOf(
      ChangeLineStateController,
    );
    await seatSoup(diningRooms, "sent");

    const response = await postDining(
      application,
      preparationUrl,
      "session_kitchen",
      {},
    );
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(preparedSoup);
    expect(line?.state).toBe("in_preparation");
    expect(line?.inPreparationAt).toBe(openedAt);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a line in preparation and a kitchen chief session, when POST /lines/:lineId/ready is injected, then the response is 200, the line is ready, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatSoup(diningRooms, "in_preparation");

    const response = await postDining(
      application,
      readyUrl,
      "session_kitchen",
      {},
    );
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...preparedSoup,
      state: "ready",
      inPreparationAt: preparedAt,
      readyAt: openedAt,
    });
    expect(line?.state).toBe("ready");
    expect(line?.inPreparationAt).toBe(preparedAt);
    expect(line?.readyAt).toBe(openedAt);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /lines/:lineId/preparation sends a client timestamp, then the response is 400 and the line stays sent", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatSoup(diningRooms, "sent");

    const response = await postDining(
      application,
      preparationUrl,
      "session_kitchen",
      { occurredAt: openedAt },
    );
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(400);
    expect(line?.state).toBe("sent");
    expect(line?.inPreparationAt).toBeUndefined();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a sent line, when POST /lines/:lineId/ready omits x-session-id, then the response is 400 and the line stays sent", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatSoup(diningRooms, "sent");

    const response = await application.inject({
      method: "POST",
      url: readyUrl,
      payload: {},
    });
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(400);
    expect(line?.state).toBe("sent");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an unknown session, when POST /lines/:lineId/preparation is injected, then the response is 403 and the line stays sent", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatSoup(diningRooms, "sent");

    const response = await postDining(
      application,
      preparationUrl,
      "session_unknown",
      {},
    );
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "UnknownSession" });
    expect(line?.state).toBe("sent");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a ready line, when POST /lines/:lineId/preparation is injected, then the response is 409 and the line stays ready", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatSoup(diningRooms, "ready");

    const response = await postDining(
      application,
      preparationUrl,
      "session_kitchen",
      {},
    );
    const line = await storedLine(diningRooms);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "LineTransitionRejected" });
    expect(line?.state).toBe("ready");
    expect(line?.readyAt).toBe(readyAt);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
