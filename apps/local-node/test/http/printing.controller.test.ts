import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  PrintingController,
  routePermissions,
} from "#src/http/printing.controller.js";

const tenantId = "organization_tenant_1";
const reprints = `/tenants/${tenantId}/reprints`;

it("given a reprint, when the node is called, then printing is rejected, nothing is stored, and the drawer stays closed", async () => {
  expect(routePermissions).toEqual({
    "POST reprints": "sale.reprint",
  });
  expect(PrintingController).toBeDefined();
  expect(PrintingController.length).toBe(0);
  const application = await createApplication();

  try {
    const response = await application.inject({
      method: "POST",
      url: reprints,
      headers: {
        "x-actor-id": "identity_cashier",
        "x-device-id": "device_register",
      },
      payload: {
        document: "invoice_setp990000001",
        kickDrawer: true,
      },
    });
    const routes = application.getHttpAdapter().getInstance().printRoutes();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "PrintingRejected" });
    expect(routes).toMatch(/reprints/);
    expect(routes).not.toMatch(/drawer/i);
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
