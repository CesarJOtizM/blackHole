import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
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
  PlaceTableController,
  routePermissions,
} from "#src/http/place-table.controller.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const tableId = "table_5";
const sessionHeader = "x-session-id";

const placeBody = {
  id: tableId,
  zone: "Terrace",
};

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const diningRooms = new InMemoryDiningRoomRepository();
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
    diningRooms,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, diningRooms };
};

const postTable = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/venues/${venueId}/dining-tables`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

it("given an owner session, when POST /dining-tables places a Terrace table, then the response is 200 and the zone is kept", async () => {
  const { application, diningRooms } = await openCloud();

  try {
    expect(routePermissions["POST dining-tables"]).toBe(
      "organization.structure",
    );
    expect(application.get(PlaceTableController)).toBeInstanceOf(
      PlaceTableController,
    );

    const response = await postTable(application, "session_owner", placeBody);
    const stored = await diningRooms.load(tenantId, venueId, tableId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: tableId,
      tenantId,
      venueId,
      zone: "Terrace",
      state: "free",
    });
    expect(stored?.zone).toBe("Terrace");
    expect(stored?.state).toBe("free");
  } finally {
    await application.close();
  }
});

it("given a cashier session without organization.structure, when POST /dining-tables is injected, then the response is 403 and nothing is saved", async () => {
  const { application, diningRooms } = await openCloud();

  try {
    const response = await postTable(application, "session_cashier", placeBody);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "OrganizationStructureDenied" });
    expect(await diningRooms.load(tenantId, venueId, tableId)).toBeNull();
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /dining-tables sends a bad body, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms } = await openCloud();

  try {
    const missing = await postTable(application, "session_owner", {});
    const stamped = await postTable(application, "session_owner", {
      ...placeBody,
      occurredAt: "2026-10-28T00:00:00.000Z",
    });

    expect(missing.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(await diningRooms.load(tenantId, venueId, tableId)).toBeNull();
  } finally {
    await application.close();
  }
});

it("given an owner session, when the table id is rejected, then the response is 409 and nothing is saved", async () => {
  const { application, diningRooms } = await openCloud();

  try {
    const response = await postTable(application, "session_owner", {
      id: "5",
      zone: "Terrace",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "InvalidTableId" });
    expect(await diningRooms.load(tenantId, venueId, tableId)).toBeNull();
    expect(await diningRooms.load(tenantId, venueId, "5")).toBeNull();
  } finally {
    await application.close();
  }
});
