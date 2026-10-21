import type { OrganizationChanged } from "@blackhole/contracts";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { expect, it } from "vitest";

import { createApplication } from "#src/create-application.js";
import {
  samplePilotActorId,
  samplePilotCommands,
  samplePilotLabel,
  samplePilotTenantId,
} from "#src/sample-pilot-structure.js";

const tenantId = "organization_tenant_1";
const actorId = "organization_actor_1";
const taxpayerId = "organization_taxpayer_1";
const otherTaxpayerId = "organization_taxpayer_2";
const duplicateTaxpayerId = "organization_taxpayer_3";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const pointId = "organization_point_1";
const secondPointId = "organization_point_2";
const stationId = "organization_station_1";
const actorHeader = "x-actor-id";

const emptySnapshot = {
  id: "",
  name: "",
  taxpayers: [],
  brands: [],
  venues: [],
  locations: [],
  kitchenStations: [],
  cashRegisters: [],
};

it("given a new tenant, when registerCompany is posted, then the cloud accepts it and stores the company", async () => {
  const { application, organizations } = await openCloud();

  try {
    const response = await postStructure(application, {
      type: "registerCompany",
      id: tenantId,
      name: "Pilot",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      actorId,
      before: emptySnapshot,
      after: {
        ...emptySnapshot,
        id: tenantId,
        name: "Pilot",
      },
    });
    expect((await organizations.load(tenantId))?.name).toBe("Pilot");
    expect(await organizations.eventsFor(tenantId)).toHaveLength(1);
  } finally {
    await application.close();
  }
});

it("given a structure command with an invalid body, when it is posted, then the response is 400 and nothing is saved", async () => {
  const { application, organizations } = await openCloud();

  try {
    const response = await postStructure(application, {
      type: "registerCompany",
      id: tenantId,
    });

    expect(response.statusCode).toBe(400);
    expect(await organizations.load(tenantId)).toBeNull();
    expect(await organizations.eventsFor(tenantId)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a taxpayer with NIT 900123456, when another taxpayer with the same NIT is posted, then the response is 409 and nothing is saved", async () => {
  const { application, organizations } = await openCloud();

  try {
    await accept(application, {
      type: "registerCompany",
      id: tenantId,
      name: "Pilot",
    });
    await accept(application, {
      type: "addTaxpayer",
      id: taxpayerId,
      nit: "900123456",
      taxProfileId: "profile-a",
    });
    const recorded = await organizations.eventsFor(tenantId);

    const response = await postStructure(application, {
      type: "addTaxpayer",
      id: duplicateTaxpayerId,
      nit: "900123456",
      taxProfileId: "profile-b",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "DuplicateNit" });
    expect(await organizations.eventsFor(tenantId)).toEqual(recorded);
    expect((await organizations.load(tenantId))?.taxpayers).toEqual([
      {
        id: taxpayerId,
        nit: "900123456",
        taxProfileId: "profile-a",
      },
    ]);
  } finally {
    await application.close();
  }
});

it("given a venue with a taxpayer, when another taxpayer is attached without replace, then the response is 409 and nothing is saved", async () => {
  const { application, organizations } = await openCloud();

  try {
    await acceptVenue(application);
    const recorded = await organizations.eventsFor(tenantId);

    const response = await postStructure(application, {
      type: "addInvoicingTaxpayer",
      venueId,
      taxpayerId: otherTaxpayerId,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "InvoicingTaxpayerAlreadyAssigned",
    });
    expect(await organizations.eventsFor(tenantId)).toEqual(recorded);
    expect((await organizations.load(tenantId))?.venues).toEqual([
      {
        id: venueId,
        name: "North",
        brandId,
        invoicingTaxpayerId: taxpayerId,
        mode: "cloud",
      },
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen station, when stock is assigned to it, then the response is 409 and nothing is saved", async () => {
  const { application, organizations } = await openCloud();

  try {
    await acceptVenue(application);
    await accept(application, {
      type: "addKitchenStation",
      id: stationId,
      venueId,
      name: "Grill",
    });
    const recorded = await organizations.eventsFor(tenantId);

    const response = await postStructure(application, {
      type: "assignStock",
      stationId,
      quantity: 4,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "StockNotHeld" });
    expect(await organizations.eventsFor(tenantId)).toEqual(recorded);
    expect((await organizations.load(tenantId))?.kitchenStations).toEqual([
      {
        id: stationId,
        venueId,
        name: "Grill",
      },
    ]);
  } finally {
    await application.close();
  }
});

it("given a venue with its point, when another point is posted, then the response is 409 and nothing is saved", async () => {
  const { application, organizations } = await openCloud();

  try {
    await acceptVenue(application);
    const recorded = await organizations.eventsFor(tenantId);

    const response = await postStructure(application, {
      type: "addPoint",
      id: secondPointId,
      venueId,
      name: "Second",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "PointAlreadyOpen" });
    expect(await organizations.eventsFor(tenantId)).toEqual(recorded);
    expect((await organizations.load(tenantId))?.locations).toEqual([
      {
        id: pointId,
        name: "North",
        kind: "point",
        venueId,
      },
    ]);
  } finally {
    await application.close();
  }
});

it("given the sample pilot fixture, when it is posted, then six cloud venues are read back", async () => {
  const { application, organizations } = await openCloud();

  try {
    let body: OrganizationChanged | undefined;

    for (const command of samplePilotCommands()) {
      const response = await application.inject({
        method: "POST",
        url: `/tenants/${samplePilotTenantId}/structure`,
        headers: {
          [actorHeader]: samplePilotActorId,
        },
        payload: command,
      });

      expect(response.statusCode).toBe(200);
      body = response.json();
    }

    const stored = await organizations.load(samplePilotTenantId);

    expect(samplePilotLabel).toBe("sample");
    expect(stored?.name).toBe(samplePilotLabel);
    expect(stored?.venues).toHaveLength(6);
    expect(stored?.venues.every((venue) => venue.mode === "cloud")).toBe(true);
    expect(stored?.taxpayers.map((taxpayer) => taxpayer.nit)).toEqual([
      "SAMPLE-NIT-01",
      "SAMPLE-NIT-02",
      "SAMPLE-NIT-03",
      "SAMPLE-NIT-04",
      "SAMPLE-NIT-05",
      "SAMPLE-NIT-06",
    ]);
    expect(body?.after.venues).toHaveLength(6);
    expect(body?.after.venues.every((venue) => venue.mode === "cloud")).toBe(
      true,
    );
  } finally {
    await application.close();
  }
});

async function openCloud() {
  const organizations = new InMemoryOrganizationRepository();
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
  });

  return { application, organizations };
}

function postStructure(
  application: Awaited<ReturnType<typeof createApplication>>,
  command: object,
) {
  return application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/structure`,
    headers: {
      [actorHeader]: actorId,
    },
    payload: command,
  });
}

async function accept(
  application: Awaited<ReturnType<typeof createApplication>>,
  command: object,
) {
  const response = await postStructure(application, command);

  expect(response.statusCode).toBe(200);

  return response;
}

async function acceptVenue(
  application: Awaited<ReturnType<typeof createApplication>>,
) {
  await accept(application, {
    type: "registerCompany",
    id: tenantId,
    name: "Pilot",
  });
  await accept(application, {
    type: "addTaxpayer",
    id: taxpayerId,
    nit: "900123456",
    taxProfileId: "profile-a",
  });
  await accept(application, {
    type: "addTaxpayer",
    id: otherTaxpayerId,
    nit: "900222222",
    taxProfileId: "profile-b",
  });
  await accept(application, {
    type: "addBrand",
    id: brandId,
    name: "House",
  });
  await accept(application, {
    type: "openVenue",
    id: venueId,
    name: "North",
    brandId,
    taxpayerId,
    pointId,
  });
}
