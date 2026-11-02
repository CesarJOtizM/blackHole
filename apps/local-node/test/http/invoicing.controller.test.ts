import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  InvoicingController,
  routePermissions,
} from "#src/http/invoicing.controller.js";

const tenantId = "organization_tenant_1";
const venueId = "venue_1";
const closureId = "closure_1";
const base = `/tenants/${tenantId}/venues/${venueId}`;

const routes = [
  { method: "POST", url: `${base}/acquirers/lookup` },
  { method: "POST", url: `${base}/closures/${closureId}/buyer` },
  { method: "POST", url: `${base}/document-balance` },
  { method: "POST", url: `${base}/numbering-ranges` },
  { method: "POST", url: `${base}/credit-notes` },
] as const;

it("given every cloud invoicing route, when the node is called, then each is rejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({
    "POST acquirers/lookup": "sale.charge",
    "POST closures/:closureId/buyer": "sale.charge",
    "POST document-balance": "tax.configure",
    "POST numbering-ranges": "tax.configure",
    "POST credit-notes": "sale.credit-note",
  });
  expect(InvoicingController).toBeDefined();
  const application = await createApplication();

  try {
    const responses = [];

    for (const route of routes) {
      responses.push({
        url: route.url,
        response: await application.inject({
          method: route.method,
          url: route.url,
          payload: { kept: false },
        }),
      });
    }

    expect(responses).toHaveLength(routes.length);

    for (const { url, response } of responses) {
      expect(response.statusCode, url).toBe(403);
      expect(response.json(), url).toEqual({ error: "InvoicingRejected" });
    }

    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
