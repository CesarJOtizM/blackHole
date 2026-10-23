import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";

const tenantId = "organization_company_1";

it("given an authorization command, when it is posted to the node, then the command is rejected and nothing is stored", async () => {
  const application = await createApplication();

  try {
    const response = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/authorization`,
      headers: {
        "x-session-id": "session_owner",
      },
      payload: {
        type: "copyRole",
        roleId: "role_copy",
        sourceRoleId: "cashier",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "PermissionCommandRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
