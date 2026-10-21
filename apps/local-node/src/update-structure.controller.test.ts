import { expect, it } from "vitest";

import { ApplicationModule } from "#src/application-module.js";
import { createApplication } from "#src/create-application.js";

const tenantId = "organization_tenant_1";

it("given a structure command, when it is posted to the node, then the edit is rejected and nothing is stored", async () => {
  const application = await createApplication();

  try {
    const response = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/structure`,
      payload: {
        type: "registerCompany",
        id: tenantId,
        name: "Pilot",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "StructureEditRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
