import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { expect, it } from "vitest";

import { ApplicationModule } from "#src/application-module.js";
import { createApplication } from "#src/create-application.js";

it("given api-cloud, when it is created and closed, then no port is listening", async () => {
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
  });

  let listening = true;

  try {
    listening = application.getHttpAdapter().getInstance().server.listening;
  } finally {
    await application.close();
  }

  expect(listening).toBe(false);
});

it("given the created application, when its routes are listed, then there is no health route", async () => {
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
  });

  try {
    const routes = application.getHttpAdapter().getInstance().printRoutes();

    expect(routes).not.toMatch(/health/i);
  } finally {
    await application.close();
  }
});

it("given startup, when it is inspected, then there is no persistence dialect", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const organizations = new InMemoryOrganizationRepository();
  const dependencies = { venueOperations, organizations };
  const application = await createApplication(dependencies);

  try {
    const registered = ApplicationModule.register(dependencies);
    const repository = application.get(VenueOperationRepository);
    const organizationRepository = application.get(OrganizationRepository);

    expect(registered.providers).toEqual([
      {
        provide: VenueOperationRepository,
        useValue: venueOperations,
      },
      {
        provide: OrganizationRepository,
        useValue: organizations,
      },
    ]);
    expect(repository).toBe(venueOperations);
    expect(repository).toBeInstanceOf(InMemoryVenueOperationRepository);
    expect(organizationRepository).toBe(organizations);
    expect(organizationRepository).toBeInstanceOf(
      InMemoryOrganizationRepository,
    );
  } finally {
    await application.close();
  }
});
