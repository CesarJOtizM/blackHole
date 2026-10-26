import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  routePermissions,
  UpdateMenuController,
} from "#src/http/update-menu.controller.js";

const tenantId = "organization_tenant_1";

it("given menu commands, when they are posted or read on the node, then both are rejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({ "POST menu": "menu.edit" });
  expect(UpdateMenuController).toBeDefined();
  const application = await createApplication();

  try {
    const posted = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/menu`,
      payload: {
        brandId: "menu_brand_1",
        command: { type: "publishProduct" },
      },
    });
    const read = await application.inject({
      method: "GET",
      url: `/tenants/${tenantId}/venues/venue_1/menu`,
    });

    expect(posted.statusCode).toBe(403);
    expect(posted.json()).toEqual({ error: "MenuRejected" });
    expect(read.statusCode).toBe(403);
    expect(read.json()).toEqual({ error: "MenuRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
