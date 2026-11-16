import { afterAll, expect, it } from "vitest";

import {
  ShortageRealtimeController,
  routePermissions,
} from "#src/http/shortage-realtime.controller.js";
import {
  chiefSession,
  closeShortageDatabases,
  kitchenNotice,
  listening,
  openShortageCloud,
  realtimeUrl,
  seedKitchenNotice,
  sessionHeader,
  waiterSession,
} from "#test/http/shortage-alerts-cloud.js";

afterAll(closeShortageDatabases);

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
  application: Awaited<ReturnType<typeof openShortageCloud>>["application"],
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

it("given shortage alerts are off, when the kitchen reads the stream, then the route is skipped and nothing is listening", async () => {
  const { application } = await openShortageCloud(false);

  try {
    const response = await application.inject({
      method: "GET",
      url: realtimeUrl,
      headers: { [sessionHeader]: chiefSession },
    });

    expect(listening(application)).toBe(false);
    expect(response.statusCode).toBe(404);
    expect(() => application.get(ShortageRealtimeController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given a waiter session, when the shortage stream is read, then the waiter is denied", async () => {
  const { application } = await openShortageCloud(true);

  try {
    expect(routePermissions["GET shortage-realtime"]).toBe("session");
    expect(application.get(ShortageRealtimeController)).toBeInstanceOf(
      ShortageRealtimeController,
    );

    const response = await application.inject({
      method: "GET",
      url: realtimeUrl,
      headers: { [sessionHeader]: waiterSession },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "ShortageNoticeDenied" });
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a site administrator notice, when the kitchen reads the stream, then the kitchen sees it and kitchenChief is not a notice role", async () => {
  const { application, inventoryDatabase } = await openShortageCloud(true);

  try {
    if (inventoryDatabase === undefined) {
      throw new Error("PostgreSQL is required.");
    }

    await seedKitchenNotice(inventoryDatabase);
    const { response, events } = await readSse(application, chiefSession, 1);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(events).toEqual([{ type: "level", data: kitchenNotice }]);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});
