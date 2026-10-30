import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  CashRegisterController,
  routePermissions,
} from "#src/http/cash-register.controller.js";

const tenantId = "organization_tenant_1";
const venueId = "venue_1";
const registerId = "register_front";
const checkId = "check_1";
const base = `/tenants/${tenantId}/venues/${venueId}`;

const routes = [
  { method: "POST", url: `${base}/cash-registers/${registerId}/open` },
  {
    method: "POST",
    url: `${base}/cash-registers/${registerId}/checks/${checkId}/charge`,
  },
  { method: "GET", url: `${base}/cash-registers/${registerId}/count` },
  { method: "POST", url: `${base}/cash-registers/${registerId}/count` },
  { method: "POST", url: `${base}/cash-registers/${registerId}/count/approve` },
  {
    method: "POST",
    url: `${base}/cash-registers/${registerId}/count/partial-close`,
  },
  {
    method: "POST",
    url: `${base}/cash-registers/${registerId}/count/final-close`,
  },
] as const;

it("given every cloud cash route, when the node is called, then each is rejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({
    "POST cash-registers/:registerId/open": "cash.open-shift",
    "POST cash-registers/:registerId/checks/:checkId/charge": "sale.charge",
    "GET cash-registers/:registerId/count": "cash.open-shift",
    "POST cash-registers/:registerId/count": "cash.open-shift",
    "POST cash-registers/:registerId/count/approve": "cash.approve-variance",
    "POST cash-registers/:registerId/count/partial-close": "cash.open-shift",
    "POST cash-registers/:registerId/count/final-close": "cash.open-shift",
  });
  expect(CashRegisterController).toBeDefined();
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
      expect(response.json(), url).toEqual({ error: "CashRegisterRejected" });
    }

    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
