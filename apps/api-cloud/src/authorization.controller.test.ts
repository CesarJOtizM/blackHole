import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization } from "@blackhole/platform/domain";
import { Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/authorization-access.js";
import { createApplication } from "#src/create-application.js";

const tenantId = "organization_company_1";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const waiterId = "user_waiter";
const venueId = "organization_venue_1";
const sessionHeader = "x-session-id";

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const clock = new FakeClock(0);
  const identity = Identity.open(tenantId);
  const passwords = new FastPasswordHasher();

  identity.registerUser({
    id: ownerId,
    displayName: "Owner",
    passwordHash: await passwords.hash("secret"),
    pinHash: "pin-hash:1111",
  });
  identity.registerUser({
    id: cashierId,
    displayName: "Cashier",
    passwordHash: await passwords.hash("secret"),
    pinHash: "pin-hash:2222",
  });
  identity.registerUser({
    id: waiterId,
    displayName: "Waiter",
    passwordHash: await passwords.hash("secret"),
    pinHash: "pin-hash:3333",
  });
  identity.signInAdministration({
    userId: ownerId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_owner",
  });
  identity.signInAdministration({
    userId: cashierId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_cashier",
  });
  identity.signInAdministration({
    userId: waiterId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_waiter",
  });
  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.open(tenantId);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: ownerId,
  });
  authorization.assign({
    assignmentId: "assignment_cashier",
    userId: cashierId,
    roleId: "cashier",
    scopeKind: "site",
    scopeId: venueId,
    validFrom: null,
    validUntil: null,
    actorUserId: ownerId,
    at: 0,
  });
  authorization.assign({
    assignmentId: "assignment_waiter",
    userId: waiterId,
    roleId: "waiter",
    scopeKind: "site",
    scopeId: venueId,
    validFrom: null,
    validUntil: null,
    actorUserId: ownerId,
    at: 0,
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
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    authorizations,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, authorizations };
};

const postAuthorization = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  command: object,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/authorization`,
    headers: { [sessionHeader]: sessionId },
    payload: command,
  });

const postCharge = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  discountPercent: number | null,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/sales/charges`,
    headers: { [sessionHeader]: sessionId },
    payload: { venueId, discountPercent },
  });

it("given an owner session, when copyRole is posted, then the cloud accepts it and stores the copy", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const response = await postAuthorization(application, "session_owner", {
      type: "copyRole",
      roleId: "role_copy",
      sourceRoleId: "cashier",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().after.customRoles).toEqual([
      expect.objectContaining({ id: "role_copy", sourceRoleId: "cashier" }),
    ]);
    expect(
      (await authorizations.load(tenantId))?.snapshot().customRoles,
    ).toHaveLength(1);
  } finally {
    await application.close();
  }
});

it("given a predefined role, when an edit is posted, then the response is 409 and nothing new is saved", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const recorded = await authorizations.eventsFor(tenantId);

    const response = await postAuthorization(application, "session_owner", {
      type: "reviseRole",
      roleId: "cashier",
      grants: [{ permission: "sale.charge", grant: "no" }],
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "PredefinedRoleRevision" });
    expect(await authorizations.eventsFor(tenantId)).toEqual(recorded);
  } finally {
    await application.close();
  }
});

it("given a waiter session, when a role copy is posted, then the response is 403 and nothing new is saved", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const recorded = await authorizations.eventsFor(tenantId);

    const response = await postAuthorization(application, "session_waiter", {
      type: "copyRole",
      roleId: "role_copy",
      sourceRoleId: "cashier",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "PermissionDenied" });
    expect(await authorizations.eventsFor(tenantId)).toEqual(recorded);
  } finally {
    await application.close();
  }
});

it("given a cashier over the discount cap, when the request is posted, then the response is 200 and requires authorization", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const response = await postAuthorization(application, "session_cashier", {
      type: "request",
      requestId: "request_discount",
      permission: "sale.discount",
      venueId,
      value: 10,
      reason: "regular",
      expiresAt: 60_000,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: "requires_authorization",
      exceededLimit: { code: "discountPercent", cap: 5, unit: "percent" },
    });
    expect(
      (await authorizations.load(tenantId))?.snapshot().requests,
    ).toHaveLength(1);
  } finally {
    await application.close();
  }
});

it("given a waiter session, when a charge is posted, then the response is 403 and nothing is stored", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const recorded = await authorizations.eventsFor(tenantId);

    const response = await postCharge(application, "session_waiter", null);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "PermissionDenied" });
    expect(await authorizations.eventsFor(tenantId)).toEqual(recorded);
  } finally {
    await application.close();
  }
});

it("given a cashier over the discount cap, when a charge is posted, then the response is 200 and nothing is stored", async () => {
  const { application, authorizations } = await openCloud();

  try {
    const recorded = await authorizations.eventsFor(tenantId);

    const response = await postCharge(application, "session_cashier", 10);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "requires_authorization",
      exceededLimit: { code: "discountPercent", cap: 5, unit: "percent" },
    });
    expect(await authorizations.eventsFor(tenantId)).toEqual(recorded);
  } finally {
    await application.close();
  }
});
