import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { Menu } from "@blackhole/orders/domain";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import type { OrganizationSnapshot } from "@blackhole/platform/application/ports/organization-repository";
import {
  Authorization,
  Identity,
  Organization,
} from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  routePermissions,
  ViewVenueMenuController,
} from "#src/http/view-venue-menu.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const otherVenueId = "organization_venue_2";
const taxpayerId = "organization_taxpayer_1";
const cashierId = "user_cashier";
const waiterId = "user_waiter";
const sessionHeader = "x-session-id";
const pinHash = "pin-hash:waiter";
const noon = Date.parse("2026-10-26T17:00:00.000Z");

const picture = (organization: Organization): OrganizationSnapshot => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const menus = new InMemoryMenuRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

  identity.registerUser({
    id: cashierId,
    displayName: cashierId,
    passwordHash: await passwords.hash("secret"),
    pinHash: `pin-hash:${cashierId}`,
  });
  identity.signInAdministration({
    userId: cashierId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_cashier",
  });
  identity.registerUser({
    id: waiterId,
    displayName: waiterId,
    passwordHash: await passwords.hash("secret"),
    pinHash,
  });
  identity.issueRegistrationCode({
    id: "registration_waiter",
    venueId,
    codeHash: "registration-code-hash",
    now: noon,
  });
  identity.registerDevice({
    registrationId: "registration_waiter",
    codeHash: "registration-code-hash",
    deviceId: "device_waiter",
    userId: waiterId,
    venueId,
    publicKey: "device-public-key",
    now: noon,
  });
  identity.startPinSession({
    userId: waiterId,
    deviceId: "device_waiter",
    pinHash,
    sessionId: "session_waiter",
  });

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: taxpayerId,
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: brandId, name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId,
    taxpayerId,
    pointId: "organization_point_1",
  });
  organization.openVenue({
    id: otherVenueId,
    name: "Site two",
    brandId,
    taxpayerId,
    pointId: "organization_point_2",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: cashierId,
    before: stored,
    after: stored,
  });

  const menu = Menu.open({ id: `menu_${brandId}`, tenantId, brandId });
  menu.publishProduct({
    id: "menu_breakfast",
    name: "Breakfast",
    price: 15_000,
    taxClassification: "iva_19",
  });
  menu.publishProduct({
    id: "menu_burger",
    name: "Burger",
    price: 20_000,
    taxClassification: "iva_19",
  });
  menu.setVenuePrice({
    venueId,
    itemId: "menu_breakfast",
    price: 15_000,
    available: true,
    window: { start: "07:00", end: "11:00" },
  });
  menu.setVenuePrice({
    venueId,
    itemId: "menu_burger",
    price: 22_000,
    available: true,
  });
  await menus.save(menu);

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_cashier",
        userId: cashierId,
        roleId: "cashier",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: null,
        validUntil: null,
      },
    ],
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });
  const authorizations = authorizationDependencies(
    identities,
    new FakeClock(noon),
  ).authorizations;
  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(noon),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(noon)),
    authorizations,
    menus,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application };
};

const readMenu = (
  application: Awaited<ReturnType<typeof createApplication>>,
  venue: string,
  sessionId: string | null,
) =>
  application.inject({
    method: "GET",
    url: `/tenants/${tenantId}/venues/${venue}/menu`,
    headers: sessionId === null ? {} : { [sessionHeader]: sessionId },
  });

it("given a pin session at noon in Bogota, when GET /menu is injected for its venue, then the response is 200 with the site price and orderable flag", async () => {
  const { application } = await openCloud();

  try {
    expect(routePermissions).toEqual({});
    expect(application.get(ViewVenueMenuController)).toBeInstanceOf(
      ViewVenueMenuController,
    );

    const response = await readMenu(application, venueId, "session_waiter");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      products: [
        expect.objectContaining({
          id: "menu_breakfast",
          price: 15_000,
          orderable: false,
        }),
        expect.objectContaining({
          id: "menu_burger",
          price: 22_000,
          orderable: true,
        }),
      ],
      combos: [],
    });
  } finally {
    await application.close();
  }
});

it("given a cashier session without menu.edit, when GET /menu is injected, then the response is 200", async () => {
  const { application } = await openCloud();

  try {
    const response = await readMenu(application, venueId, "session_cashier");

    expect(response.statusCode).toBe(200);
    expect(response.json().products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "menu_burger", price: 22_000 }),
      ]),
    );
  } finally {
    await application.close();
  }
});

it("given a pin session, when GET /menu is injected for another venue, then the response is 403", async () => {
  const { application } = await openCloud();

  try {
    const response = await readMenu(
      application,
      otherVenueId,
      "session_waiter",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "MenuReadDenied" });
  } finally {
    await application.close();
  }
});

it("given no session, when GET /menu is injected, then the response is 400", async () => {
  const { application } = await openCloud();

  try {
    const response = await readMenu(application, venueId, null);

    expect(response.statusCode).toBe(400);
  } finally {
    await application.close();
  }
});
