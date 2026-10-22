import { expect, it } from "vitest";

import { ApplicationModule } from "#src/application-module.js";
import { createApplication } from "#src/create-application.js";

const tenantId = "organization_company_1";

it("given an identity command, when it is posted to the node, then the command is rejected and nothing is stored", async () => {
  const application = await createApplication();

  try {
    const response = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/identity`,
      headers: {
        "x-session-id": "session_owner",
      },
      payload: {
        siteOffline: false,
        command: {
          type: "signInAdministration",
          userId: "user_owner",
          password: "owner-password",
          factorCode: null,
          sessionId: "session_owner",
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "IdentityCommandRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
