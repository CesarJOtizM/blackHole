import { RealtimeHub } from "@blackhole/orders/application/ports/realtime-hub";
import { expect, it } from "vitest";

import {
  OrdersRealtimeController,
  routePermissions,
} from "#src/http/orders-realtime.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  sessionHeader,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const realtimeUrl = diningPath("orders-realtime");
const lineId = "line_soup";
const stationId = "station_grill";
const readyAt = "2026-10-28T12:06:00.000Z";
const ticketText = "Grill\ntable_5\nJalapeño";

const parseSse = (payload: string) =>
  payload
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block.includes("data: "))
    .map((block) => {
      const type = block
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");

      return { type, data: JSON.parse(data) as unknown };
    });

const readSse = async (
  application: Awaited<ReturnType<typeof openDiningCloud>>["application"],
  sessionId: string,
  expectedEvents: number,
) => {
  const response = await application.inject({
    method: "GET",
    url: realtimeUrl,
    headers: { [sessionHeader]: sessionId },
    payloadAsStream: true,
  });
  const stream = response.stream();
  let payload = "";

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SSE timed out with payload: ${payload}`));
    }, 3_000);

    stream.on("data", (chunk: Buffer | string) => {
      payload += chunk.toString();

      if (parseSse(payload).length >= expectedEvents) {
        clearTimeout(timer);
        resolve();
      }
    });
    stream.on("error", (error: unknown) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  return { response, events: parseSse(payload) };
};

it("given a send, when SSE is read, then the event carries ids only and printer_failed and line_ready ride the same stream", async () => {
  const { application, audits } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "GET orders-realtime": "session",
    });
    expect(application.get(OrdersRealtimeController)).toBeInstanceOf(
      OrdersRealtimeController,
    );
    const hub = application.get(RealtimeHub);

    await hub.publish({
      kind: "ids",
      tenantId,
      venueId,
      checkId,
      tableId,
      lineIds: [lineId],
    });
    await hub.publish({
      kind: "printer_failed",
      tenantId,
      venueId,
      checkId,
      tableId,
      lineId,
      stationId,
      text: ticketText,
    });
    await hub.publish({
      kind: "line_ready",
      tenantId,
      venueId,
      checkId,
      tableId,
      lineId,
      at: readyAt,
    });
    await hub.publish({
      kind: "billing_data_received",
      tenantId,
      venueId,
      checkId,
      tableId,
    });
    await hub.publish({
      kind: "ids",
      tenantId: "organization_other",
      venueId,
      checkId,
      tableId,
      lineIds: ["line_hidden"],
    });

    const { response, events } = await readSse(
      application,
      "session_kitchen",
      4,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(events).toEqual([
      {
        type: "ids",
        data: {
          kind: "ids",
          tenantId,
          venueId,
          checkId,
          tableId,
          lineIds: [lineId],
        },
      },
      {
        type: "printer_failed",
        data: {
          kind: "printer_failed",
          tenantId,
          venueId,
          checkId,
          tableId,
          lineId,
          stationId,
        },
      },
      {
        type: "line_ready",
        data: {
          kind: "line_ready",
          tenantId,
          venueId,
          checkId,
          tableId,
          lineId,
          at: readyAt,
        },
      },
      {
        type: "billing_data_received",
        data: {
          kind: "billing_data_received",
          tenantId,
          venueId,
          checkId,
          tableId,
        },
      },
    ]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when SSE omits x-session-id, then the response is 400", async () => {
  const { application, audits } = await openDiningCloud();

  try {
    const response = await application.inject({
      method: "GET",
      url: realtimeUrl,
    });

    expect(response.statusCode).toBe(400);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
