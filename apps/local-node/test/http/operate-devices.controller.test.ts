import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";

const tenantId = "organization_company_1";

it("given a device command, when it is posted to the node, then the command is rejected and nothing is stored", async () => {
  const application = await createApplication();

  try {
    const response = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/devices`,
      payload: {
        siteOffline: false,
        command: {
          type: "issueRegistrationCode",
          id: "registration_1",
          venueId: "organization_venue_1",
          code: "shown-once",
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "DeviceCommandRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
