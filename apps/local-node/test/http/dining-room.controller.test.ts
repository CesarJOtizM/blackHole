import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  DiningRoomController,
  routePermissions,
} from "#src/http/dining-room.controller.js";

const tenantId = "organization_tenant_1";
const venueId = "venue_1";
const tableId = "table_terrace";
const checkId = "check_1";
const lineId = "line_1";
const stationId = "station_grill";
const base = `/tenants/${tenantId}/venues/${venueId}`;

const routes = [
  { method: "POST", url: `${base}/dining-tables` },
  { method: "POST", url: `${base}/station-routes` },
  { method: "POST", url: `${base}/dining-tables/${tableId}/open` },
  { method: "POST", url: `${base}/dining-tables/${tableId}/release` },
  { method: "POST", url: `${base}/dining-tables/${tableId}/ready` },
  { method: "POST", url: `${base}/checks/${checkId}/bill` },
  { method: "POST", url: `${base}/checks/${checkId}/lines` },
  { method: "POST", url: `${base}/checks/${checkId}/send` },
  { method: "POST", url: `${base}/checks/${checkId}/lines/${lineId}/resend` },
  { method: "POST", url: `${base}/checks/${checkId}/lines/${lineId}/deliver` },
  { method: "POST", url: `${base}/checks/reassign` },
  {
    method: "POST",
    url: `${base}/checks/${checkId}/lines/${lineId}/preparation`,
  },
  { method: "POST", url: `${base}/checks/${checkId}/lines/${lineId}/ready` },
  { method: "GET", url: `${base}/table-map` },
  { method: "GET", url: `${base}/stations/${stationId}/queue` },
  { method: "GET", url: `${base}/checks/${checkId}` },
  { method: "GET", url: `${base}/orders-realtime` },
] as const;

it("given every cloud dining route, when the node is called, then each is rejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({
    "POST dining-tables": "organization.structure",
    "POST station-routes": "organization.structure",
    "POST dining-tables/:tableId/open": "sale.open-table",
    "POST dining-tables/:tableId/release": "sale.open-table",
    "POST dining-tables/:tableId/ready": "sale.open-table",
    "POST checks/:checkId/bill": "sale.open-table",
    "POST checks/:checkId/lines": "sale.open-table",
    "POST checks/:checkId/send": "sale.open-table",
    "POST checks/:checkId/lines/:lineId/resend": "sale.open-table",
    "POST checks/:checkId/lines/:lineId/deliver": "sale.open-table",
    "POST checks/reassign": "sale.move-items",
    "POST checks/:checkId/lines/:lineId/preparation": "session",
    "POST checks/:checkId/lines/:lineId/ready": "session",
    "GET table-map": "session",
    "GET stations/:stationId/queue": "session",
    "GET checks/:checkId": "session",
    "GET orders-realtime": "session",
  });
  expect(DiningRoomController).toBeDefined();
  const application = await createApplication();

  try {
    const responses = [];

    for (const route of routes) {
      responses.push({
        url: route.url,
        response: await application.inject({
          method: route.method,
          url: route.url,
          payload: route.method === "POST" ? { kept: false } : undefined,
        }),
      });
    }

    expect(responses).toHaveLength(routes.length);

    for (const { url, response } of responses) {
      expect(response.statusCode, url).toBe(403);
      expect(response.json(), url).toEqual({ error: "DiningRoomRejected" });
      expect(String(response.headers["content-type"]), url).not.toContain(
        "text/event-stream",
      );
    }

    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
