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
import type { AuditEvent } from "@blackhole/platform/application/ports/audit-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";

const tenantId = "organization_company_1";
const siteOne = "organization_venue_1";
const siteTwo = "organization_venue_2";
const ownerId = "user_owner";
const auditorId = "user_auditor";
const adminId = "user_admin";
const cashierId = "user_cashier";
const sessionHeader = "x-session-id";

const row = (siteId: string): AuditEvent => ({
  tenantId,
  actorId: cashierId,
  authorizerId: null,
  deviceId: `device_${siteId}`,
  siteId,
  action: "sale.void-account",
  entity: `check_${siteId}`,
  before: { amount: siteId === siteOne ? 9_000_000 : 1_000 },
  after: { amount: 0 },
  reason: "stored",
  occurredAt: 1,
  sequence: 1,
  previousHash: "0".repeat(64),
  digest: `digest-${siteId}`,
  kind: "event",
});

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [auditorId, "session_auditor"],
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
        id: "assignment_auditor",
        userId: auditorId,
        roleId: "auditor",
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
        scopeId: siteOne,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_cashier",
        userId: cashierId,
        roleId: "cashier",
        scopeKind: "site",
        scopeId: siteOne,
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
  const firstSite = row(siteOne);
  const secondSite = row(siteTwo);
  await audits.append(firstSite);
  await audits.append(secondSite);

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
    audits,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, firstSite, secondSite };
};

const readAudit = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  siteId: string | null,
) => {
  const site = siteId === null ? "" : `&siteId=${siteId}`;

  return application.inject({
    method: "GET",
    url: `/audit?tenantId=${tenantId}${site}`,
    headers: { [sessionHeader]: sessionId },
  });
};

it("given an owner session, when GET /audit is injected, then the company audit returns 200 and write stays false", async () => {
  const { application, firstSite, secondSite } = await openCloud();

  try {
    const response = await readAudit(application, "session_owner", null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      events: [firstSite, secondSite],
      write: false,
    });
  } finally {
    await application.close();
  }
});

it("given an auditor session, when GET /audit is injected, then the company audit returns 200 and write stays false", async () => {
  const { application, firstSite, secondSite } = await openCloud();

  try {
    const response = await readAudit(application, "session_auditor", null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      events: [firstSite, secondSite],
      write: false,
    });
  } finally {
    await application.close();
  }
});

it("given a site administrator, when GET /audit is injected for their site, then only that site returns 200", async () => {
  const { application, firstSite } = await openCloud();

  try {
    const response = await readAudit(application, "session_admin", siteOne);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ events: [firstSite], write: false });
  } finally {
    await application.close();
  }
});

it("given a site administrator, when GET /audit is injected for the other site, then the response is 403", async () => {
  const { application } = await openCloud();

  try {
    const response = await readAudit(application, "session_admin", siteTwo);

    expect(response.statusCode).toBe(403);
  } finally {
    await application.close();
  }
});

it("given a cashier session, when GET /audit is injected, then the response is 403", async () => {
  const { application } = await openCloud();

  try {
    const response = await readAudit(application, "session_cashier", siteOne);

    expect(response.statusCode).toBe(403);
  } finally {
    await application.close();
  }
});

it("given the audit route, when POST, PUT, or DELETE is injected, then each response is 404", async () => {
  const { application } = await openCloud();

  try {
    const methods = ["POST", "PUT", "DELETE"] as const;

    for (const method of methods) {
      const response = await application.inject({
        method,
        url: `/audit?tenantId=${tenantId}`,
        headers: { [sessionHeader]: "session_owner" },
      });

      expect(response.statusCode).toBe(404);
    }
  } finally {
    await application.close();
  }
});
