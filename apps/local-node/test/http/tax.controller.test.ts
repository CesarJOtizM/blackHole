import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import { routePermissions, TaxController } from "#src/http/tax.controller.js";

const tenantId = "organization_tenant_1";

it("given a tax quote, publish, and adopt, when they are posted on the node, then each is rejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({
    "POST tax-quotes": "tax.configure",
    "POST tax-rules": "tax.configure",
    "POST fiscal-profiles/adopt": "tax.configure",
  });
  expect(TaxController).toBeDefined();
  const application = await createApplication();

  try {
    const quote = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/tax-quotes`,
      payload: {
        lines: [{ priceCop: 10_800, taxClassification: "restaurant service" }],
      },
    });
    const published = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/tax-rules`,
      payload: {
        classification: "restaurant service",
        rate: "0.08",
      },
    });
    const adopted = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/fiscal-profiles/adopt`,
      payload: {
        templateName: "SIMPLE regime, INC responsible",
      },
    });

    expect(quote.statusCode).toBe(403);
    expect(quote.json()).toEqual({ error: "TaxRejected" });
    expect(published.statusCode).toBe(403);
    expect(published.json()).toEqual({ error: "TaxRejected" });
    expect(adopted.statusCode).toBe(403);
    expect(adopted.json()).toEqual({ error: "TaxRejected" });
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
