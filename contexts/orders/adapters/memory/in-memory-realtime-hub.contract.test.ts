import { expect, it } from "vitest";

import { InMemoryRealtimeHub } from "#adapters/memory/in-memory-realtime-hub.js";
import type { RealtimeNotice } from "#application/ports/realtime-hub.js";

const TENANT_ID = "organization_tenant_a";
const VENUE_ID = "organization_venue_1";

it("given ids, printer_failed, and line_ready, when they are published, then the hub records each notice", async () => {
  const hub = new InMemoryRealtimeHub();
  const lineIds = ["line_soup"];
  const ids: RealtimeNotice = {
    kind: "ids",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: "check_5",
    tableId: "table_5",
    lineIds,
  };
  const printerFailed: RealtimeNotice = {
    kind: "printer_failed",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: "check_5",
    tableId: "table_5",
    lineId: "line_soup",
    stationId: "station_grill",
    text: "Grill\ntable_5\nJalapeño",
  };
  const lineReady: RealtimeNotice = {
    kind: "line_ready",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: "check_5",
    tableId: "table_5",
    lineId: "line_soup",
    at: "2026-10-28T12:06:00.000Z",
  };

  await hub.publish(ids);
  await hub.publish(printerFailed);
  await hub.publish(lineReady);
  lineIds.push("line_extra");

  expect(hub.published).toEqual([
    {
      kind: "ids",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: "check_5",
      tableId: "table_5",
      lineIds: ["line_soup"],
    },
    printerFailed,
    lineReady,
  ]);
});
