import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { Check, DiningTable } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  ReassignCheckController,
  routePermissions,
} from "#src/http/reassign-check.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  openedAt,
  ownerId,
  postDining,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const sourceTableId = "table_6";
const sourceCheckId = "check_6";
const sentAt = "2026-10-28T12:03:10.000Z";
const reassignUrl = diningPath("checks/reassign");
const steak = {
  orderId: "order_5",
  lineId: "line_steak",
  productId: "menu_product_steak",
  name: "Steak",
  price: 15_000,
};
const soup = {
  orderId: "order_6",
  lineId: "line_soup",
  productId: "menu_product_soup",
  name: "Soup",
  price: 9_000,
};
const salad = {
  orderId: "order_6",
  lineId: "line_salad",
  productId: "menu_product_salad",
  name: "Salad",
  price: 8_000,
};

const joinCommand = {
  kind: "join" as const,
  targetCheckId: checkId,
  sourceCheckId,
};

const lineView = (check: Check | null) =>
  check?.orders.flatMap((order) =>
    order.lines.map((line) => ({
      id: line.id,
      originTableId: line.originTableId,
      state: line.state,
    })),
  ) ?? [];

const seatPair = async (
  diningRooms: InMemoryDiningRoomRepository,
  input?: {
    sourceTable?: "occupied" | "free";
    sourceLines?: readonly (typeof soup)[];
  },
) => {
  const targetTable = DiningTable.place({
    id: "table_5",
    tenantId,
    venueId,
    zone: "Terrace",
  });
  const sourceTable = DiningTable.place({
    id: sourceTableId,
    tenantId,
    venueId,
    zone: "Terrace",
  });

  targetTable.open({ diners: 4 });

  if (input?.sourceTable !== "free") {
    sourceTable.open({ diners: 2 });
  }

  const target = Check.open({
    id: checkId,
    tenantId,
    venueId,
    tableId: "table_5",
    openedAt,
  });
  const source = Check.open({
    id: sourceCheckId,
    tenantId,
    venueId,
    tableId: sourceTableId,
    openedAt,
  });

  for (const line of [steak]) {
    target.addLine({ ...line, course: 1, channel: "waiter" });
  }

  for (const line of input?.sourceLines ?? [soup]) {
    source.addLine({ ...line, course: 1, channel: "waiter" });
  }

  target.send({ course: 1, sentAt });
  source.send({ course: 1, sentAt });
  await diningRooms.save(targetTable);
  await diningRooms.save(sourceTable);
  await diningRooms.saveCheck(target);
  await diningRooms.saveCheck(source);
};

it("given table 6 joined into table 5, when POST /checks/reassign is injected, then the response is 200, origins stay, and the audit records the move", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "POST checks/reassign": "sale.move-items",
    });
    expect(application.get(ReassignCheckController)).toBeInstanceOf(
      ReassignCheckController,
    );
    await seatPair(diningRooms);

    const response = await postDining(
      application,
      reassignUrl,
      "session_owner",
      joinCommand,
    );
    const storedTarget = await diningRooms.loadCheck(
      tenantId,
      venueId,
      checkId,
    );
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: checkId,
      tableId: "table_5",
      sourceCheckId,
      kind: "join",
      lines: [
        {
          id: steak.lineId,
          originTableId: "table_5",
          state: "sent",
        },
        {
          id: soup.lineId,
          originTableId: sourceTableId,
          state: "sent",
        },
      ],
    });
    expect(lineView(storedTarget)).toEqual([
      { id: steak.lineId, originTableId: "table_5", state: "sent" },
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(storedSource?.orders).toEqual([]);
    expect(storedTarget?.tableState).toBe("occupied");
    expect(storedSource?.tableState).toBe("occupied");
    expect((await diningRooms.load(tenantId, venueId, "table_5"))?.state).toBe(
      "occupied",
    );
    expect(
      (await diningRooms.load(tenantId, venueId, sourceTableId))?.state,
    ).toBe("occupied");
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "sale.move-items",
        entity: checkId,
        before: {
          kind: "join",
          targetCheckId: checkId,
          sourceCheckId,
        },
        after: {
          kind: "join",
          targetCheckId: checkId,
          sourceCheckId,
          lineIds: [steak.lineId, soup.lineId],
        },
        reason: "sale.move-items",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a transfer, when POST /checks/reassign is injected, then the named line moves, states stay, and the audit records the save", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatPair(diningRooms, { sourceLines: [soup, salad] });

    const response = await postDining(
      application,
      reassignUrl,
      "session_owner",
      {
        kind: "transfer",
        targetCheckId: checkId,
        sourceCheckId,
        lineIds: [salad.lineId],
      },
    );
    const storedTarget = await diningRooms.loadCheck(
      tenantId,
      venueId,
      checkId,
    );
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: checkId,
      tableId: "table_5",
      sourceCheckId,
      kind: "transfer",
      lines: [
        {
          id: steak.lineId,
          originTableId: "table_5",
          state: "sent",
        },
        {
          id: salad.lineId,
          originTableId: sourceTableId,
          state: "sent",
        },
      ],
    });
    expect(lineView(storedSource)).toEqual([
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(storedTarget?.tableState).toBe("occupied");
    expect(storedSource?.tableState).toBe("occupied");
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.move-items",
        entity: checkId,
        after: {
          kind: "transfer",
          targetCheckId: checkId,
          sourceCheckId,
          lineIds: [steak.lineId, salad.lineId],
        },
        reason: "sale.move-items",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/reassign is injected, then the response is 403, both checks stay, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatPair(diningRooms);

    const response = await postDining(
      application,
      reassignUrl,
      "session_kitchen",
      joinCommand,
    );
    const storedTarget = await diningRooms.loadCheck(
      tenantId,
      venueId,
      checkId,
    );
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleMoveItemsDenied" });
    expect(lineView(storedTarget)).toEqual([
      { id: steak.lineId, originTableId: "table_5", state: "sent" },
    ]);
    expect(lineView(storedSource)).toEqual([
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/reassign sends a client timestamp, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatPair(diningRooms);

    const response = await postDining(
      application,
      reassignUrl,
      "session_owner",
      { ...joinCommand, occurredAt: openedAt },
    );
    const storedTarget = await diningRooms.loadCheck(
      tenantId,
      venueId,
      checkId,
    );
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(400);
    expect(lineView(storedTarget)).toEqual([
      { id: steak.lineId, originTableId: "table_5", state: "sent" },
    ]);
    expect(lineView(storedSource)).toEqual([
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/reassign omits x-session-id, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatPair(diningRooms);

    const response = await application.inject({
      method: "POST",
      url: reassignUrl,
      payload: joinCommand,
    });
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(400);
    expect(lineView(storedSource)).toEqual([
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a free source table, when POST /checks/reassign is injected, then the response is 409 and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openDiningCloud();

  try {
    await seatPair(diningRooms, { sourceTable: "free" });

    const response = await postDining(
      application,
      reassignUrl,
      "session_owner",
      joinCommand,
    );
    const storedTarget = await diningRooms.loadCheck(
      tenantId,
      venueId,
      checkId,
    );
    const storedSource = await diningRooms.loadCheck(
      tenantId,
      venueId,
      sourceCheckId,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "TableNotOpen" });
    expect(lineView(storedTarget)).toEqual([
      { id: steak.lineId, originTableId: "table_5", state: "sent" },
    ]);
    expect(lineView(storedSource)).toEqual([
      { id: soup.lineId, originTableId: sourceTableId, state: "sent" },
    ]);
    expect(
      (await diningRooms.load(tenantId, venueId, sourceTableId))?.state,
    ).toBe("free");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
