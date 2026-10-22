import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";

it("given local-node, when it is created and closed, then no port is listening", async () => {
  const application = await createApplication();

  let listening = true;

  try {
    listening = application.getHttpAdapter().getInstance().server.listening;
  } finally {
    await application.close();
  }

  expect(listening).toBe(false);
});

it("given the created application, when its routes are listed, then there is no health route", async () => {
  const application = await createApplication();

  try {
    const routes = application.getHttpAdapter().getInstance().printRoutes();

    expect(routes).not.toMatch(/health/i);
  } finally {
    await application.close();
  }
});

it("given startup, when it is inspected, then there is no persistence dialect", async () => {
  const application = await createApplication();

  try {
    const imports = Reflect.getMetadata("imports", ApplicationModule) ?? [];
    const providers = Reflect.getMetadata("providers", ApplicationModule) ?? [];

    expect(imports).toEqual([]);
    expect(providers).toEqual([]);
  } finally {
    await application.close();
  }
});
