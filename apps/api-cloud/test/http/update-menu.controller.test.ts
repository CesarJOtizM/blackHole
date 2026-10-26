import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
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
  UpdateMenuController,
} from "#src/http/update-menu.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const otherVenueId = "organization_venue_2";
const taxpayerId = "organization_taxpayer_1";
const ownerId = "user_owner";
const adminId = "user_admin";
const cashierId = "user_cashier";
const sessionHeader = "x-session-id";
const productId = "menu_burger";

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

const publishBurger = {
  brandId,
  command: {
    type: "publishProduct",
    id: productId,
    name: "Burger",
    price: 20_000,
    taxClassification: "iva_19",
  },
};

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const audits = new InMemoryAuditRepository();
  const menus = new InMemoryMenuRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [adminId, "session_admin"],
    [cashierId, "session_cashier"],
  ] as const;

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

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
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_owner",
        userId: ownerId,
        roleId: "owner",
        scopeKind: "company",
        scopeId: tenantId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_admin",
        userId: adminId,
        roleId: "siteAdministrator",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: null,
        validUntil: null,
      },
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
    clock: new FakeClock(0),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(0)),
    authorizations,
    audits,
    menus,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, menus, audits };
};

const postMenu = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/menu`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

it("given an owner session, when POST /menu publishes a product, then the response is 200, the menu is saved, and the audit records the price", async () => {
  const { application, menus, audits } = await openCloud();

  try {
    expect(routePermissions["POST menu"]).toBe("menu.edit");
    expect(application.get(UpdateMenuController)).toBeInstanceOf(
      UpdateMenuController,
    );

    const response = await postMenu(
      application,
      "session_owner",
      publishBurger,
    );
    const menu = await menus.load(tenantId, brandId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      menuId: `menu_${brandId}`,
      brandId,
    });
    expect(menu?.products).toEqual([
      expect.objectContaining({
        id: productId,
        name: "Burger",
        price: 20_000,
      }),
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        siteId: brandId,
        action: "menu.edit",
        entity: productId,
        before: { price: null },
        after: { price: 20_000 },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a cashier session, when POST /menu is injected, then the response is 403 and nothing is saved", async () => {
  const { application, menus, audits } = await openCloud();

  try {
    const response = await postMenu(
      application,
      "session_cashier",
      publishBurger,
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "MenuEditDenied" });
    expect(await menus.load(tenantId, brandId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a site administrator, when she sets the price of another site, then the response is 403 and the price stays unchanged", async () => {
  const { application, menus } = await openCloud();

  try {
    const published = await postMenu(
      application,
      "session_owner",
      publishBurger,
    );
    const response = await postMenu(application, "session_admin", {
      brandId,
      command: {
        type: "setVenuePrice",
        venueId: otherVenueId,
        itemId: productId,
        price: 22_000,
        available: true,
      },
    });
    const menu = await menus.load(tenantId, brandId);

    expect(published.statusCode).toBe(200);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "MenuEditDenied" });
    expect(menu?.venuePrices).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /menu omits the command, then the response is 400 and nothing is saved", async () => {
  const { application, menus } = await openCloud();

  try {
    const response = await postMenu(application, "session_owner", { brandId });

    expect(response.statusCode).toBe(400);
    expect(await menus.load(tenantId, brandId)).toBeNull();
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /menu sends a fractional price, then the response is 409 and nothing is saved", async () => {
  const { application, menus, audits } = await openCloud();

  try {
    const response = await postMenu(application, "session_owner", {
      ...publishBurger,
      command: { ...publishBurger.command, price: 20.5 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "InvalidMenuPrice" });
    expect(await menus.load(tenantId, brandId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a site administrator, when she sets her own site price, then the response is 200 and the audit records the old and new price", async () => {
  const { application, menus, audits } = await openCloud();

  try {
    await postMenu(application, "session_owner", publishBurger);
    const response = await postMenu(application, "session_admin", {
      brandId,
      command: {
        type: "setVenuePrice",
        venueId,
        itemId: productId,
        price: 22_000,
        available: true,
      },
    });
    const menu = await menus.load(tenantId, brandId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(menu?.venuePrices).toEqual([
      expect.objectContaining({
        venueId,
        itemId: productId,
        price: 22_000,
      }),
    ]);
    expect(events[1]).toEqual(
      expect.objectContaining({
        actorId: adminId,
        siteId: venueId,
        action: "menu.edit",
        entity: productId,
        before: { price: 20_000 },
        after: { price: 22_000 },
      }),
    );
  } finally {
    await application.close();
  }
});
