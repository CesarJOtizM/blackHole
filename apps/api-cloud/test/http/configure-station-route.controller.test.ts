import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  ConfigureStationRouteController,
  routePermissions,
} from "#src/http/configure-station-route.controller.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const stationId = "station_grill";
const coldId = "station_cold";
const productId = "menu_product_steak";
const sessionHeader = "x-session-id";

const routeBody = {
  station: { id: stationId, venueId, name: "Grill" },
  productId,
  output: "both",
  redThresholdMinutes: 15,
};

const savedRoute = {
  tenantId,
  venueId,
  stationId,
  stationName: "Grill",
  productId,
  output: "both",
  redThresholdMinutes: 15,
};

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const stationRoutes = new InMemoryStationRouteRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
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
        id: "assignment_cashier",
        userId: cashierId,
        roleId: "cashier",
        scopeKind: "company",
        scopeId: tenantId,
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
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(0),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(0)),
    authorizations,
    stationRoutes,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, stationRoutes };
};

const postRoute = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/venues/${venueId}/station-routes`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

it("given an owner session, when POST /station-routes routes a product, then the response is 200 and the route is per venue", async () => {
  const { application, stationRoutes } = await openCloud();

  try {
    expect(routePermissions["POST station-routes"]).toBe(
      "organization.structure",
    );
    expect(application.get(ConfigureStationRouteController)).toBeInstanceOf(
      ConfigureStationRouteController,
    );

    const response = await postRoute(application, "session_owner", routeBody);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(savedRoute);
    expect(await stationRoutes.load(tenantId, venueId)).toEqual([savedRoute]);
  } finally {
    await application.close();
  }
});

it("given a cashier session without organization.structure, when POST /station-routes is injected, then the response is 403 and nothing is saved", async () => {
  const { application, stationRoutes } = await openCloud();

  try {
    const response = await postRoute(application, "session_cashier", routeBody);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "OrganizationStructureDenied" });
    expect(await stationRoutes.load(tenantId, venueId)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /station-routes sends a bad body, then the response is 400 and nothing is saved", async () => {
  const { application, stationRoutes } = await openCloud();

  try {
    const missing = await postRoute(application, "session_owner", {});
    const unknownOutput = await postRoute(application, "session_owner", {
      ...routeBody,
      output: "fax",
    });
    const stamped = await postRoute(application, "session_owner", {
      ...routeBody,
      occurredAt: "2026-10-28T00:00:00.000Z",
    });

    expect(missing.statusCode).toBe(400);
    expect(unknownOutput.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(await stationRoutes.load(tenantId, venueId)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given the product again, when POST /station-routes is injected, then the response is 409 and nothing new is saved", async () => {
  const { application, stationRoutes } = await openCloud();

  try {
    const first = await postRoute(application, "session_owner", routeBody);
    const again = await postRoute(application, "session_owner", {
      ...routeBody,
      station: { id: coldId, venueId, name: "Cold" },
      output: "screen",
      redThresholdMinutes: 10,
    });

    expect(first.statusCode).toBe(200);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: "DuplicateStationProduct" });
    expect(await stationRoutes.load(tenantId, venueId)).toEqual([savedRoute]);
  } finally {
    await application.close();
  }
});
