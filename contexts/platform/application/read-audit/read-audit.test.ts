import { expect, it } from "vitest";

import {
  FakeAuthorizationClock,
  InMemorySessionReader,
} from "#adapters/memory/authorization-doubles.js";
import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import {
  AuditReadDenied,
  ReadAudit,
} from "#application/read-audit/read-audit.js";
import { Authorization } from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const SITE_1 = "organization_venue_1";
const SITE_2 = "organization_venue_2";
const OWNER_ID = "user_owner";
const MANAGER_ID = "user_manager";
const ADMIN_ID = "user_admin";
const CASHIER_ID = "user_cashier";
const AUDITOR_ID = "user_auditor";

const row = (siteId: string, amount: number): AuditEvent => ({
  tenantId: TENANT_ID,
  actorId: "user_cashier",
  authorizerId: null,
  deviceId: `device_${siteId}`,
  siteId,
  action: "sale.void-account",
  entity: `check_${siteId}`,
  before: { amount },
  after: { amount: 0 },
  reason: "stored",
  occurredAt: amount,
  sequence: 1,
  previousHash: "0".repeat(64),
  digest: `digest-${siteId}`,
  kind: "event",
});

const openReaders = async () => {
  const audits = new InMemoryAuditRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const sessions = new InMemorySessionReader();
  const siteOne = row(SITE_1, 9_000_000);
  const siteTwo = row(SITE_2, 1_000);
  await audits.append(siteOne);
  await audits.append(siteTwo);

  const authorization = Authorization.restore({
    tenantId: TENANT_ID,
    customRoles: [],
    assignments: [
      {
        id: "assignment_owner",
        userId: OWNER_ID,
        roleId: "owner",
        scopeKind: "company",
        scopeId: TENANT_ID,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_manager",
        userId: MANAGER_ID,
        roleId: "generalManager",
        scopeKind: "company",
        scopeId: TENANT_ID,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_admin",
        userId: ADMIN_ID,
        roleId: "siteAdministrator",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_cashier",
        userId: CASHIER_ID,
        roleId: "cashier",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_auditor",
        userId: AUDITOR_ID,
        roleId: "auditor",
        scopeKind: "company",
        scopeId: TENANT_ID,
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
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });

  const people = [
    ["session_owner", OWNER_ID],
    ["session_manager", MANAGER_ID],
    ["session_admin", ADMIN_ID],
    ["session_cashier", CASHIER_ID],
    ["session_auditor", AUDITOR_ID],
  ] as const;

  for (const [sessionId, userId] of people) {
    sessions.put(TENANT_ID, {
      sessionId,
      userId,
      displayName: userId,
      deviceId: "device_phone_1",
      venueId: null,
      kind: "administration",
    });
  }

  sessions.put(TENANT_ID, {
    sessionId: "session_owner_pin",
    userId: OWNER_ID,
    displayName: OWNER_ID,
    deviceId: "device_phone_1",
    venueId: SITE_1,
    kind: "pin",
  });

  const read = new ReadAudit(
    audits,
    authorizations,
    sessions,
    new FakeAuthorizationClock(0),
  );

  return { read, siteOne, siteTwo };
};

it("given an owner session, when they read audit.view for the company, then both sites return and write stays false", async () => {
  const { read, siteOne, siteTwo } = await openReaders();

  const result = await read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    siteId: null,
    permission: PERMISSION.AUDIT_VIEW,
  });

  expect(result.write).toBe(false);
  expect(result.events).toEqual([siteOne, siteTwo]);
});

it("given a general manager session, when they read the company audit, then both sites return and write stays false", async () => {
  const { read, siteOne, siteTwo } = await openReaders();

  const result = await read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_manager",
    siteId: null,
    permission: PERMISSION.AUDIT_VIEW,
  });

  expect(result.write).toBe(false);
  expect(result.events).toEqual([siteOne, siteTwo]);
});

it("given an auditor session, when they read the company audit, then it is shown and write stays false", async () => {
  const { read, siteOne, siteTwo } = await openReaders();

  const result = await read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_auditor",
    siteId: null,
    permission: PERMISSION.AUDIT_VIEW,
  });

  expect(result.write).toBe(false);
  expect(result.events).toEqual([siteOne, siteTwo]);
});

it("given audit.view with_limit for site 1, when that administrator reads site 2, then it is denied", async () => {
  const { read } = await openReaders();

  const readOtherSite = read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_admin",
    siteId: SITE_2,
    permission: PERMISSION.AUDIT_VIEW,
  });

  await expect(readOtherSite).rejects.toBeInstanceOf(AuditReadDenied);
});

it("given audit.view with_limit for site 1, when that administrator reads site 1, then only that site returns including a large amount", async () => {
  const { read, siteOne } = await openReaders();

  const result = await read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_admin",
    siteId: SITE_1,
    permission: PERMISSION.AUDIT_VIEW,
  });

  expect(result.write).toBe(false);
  expect(result.events).toEqual([siteOne]);
  expect(siteOne.before).toEqual({ amount: 9_000_000 });
});

it("given a PIN session opened at site 1, when the owner reads site 1 and site 2, then only site 1 returns and site 2 is denied", async () => {
  const { read, siteOne } = await openReaders();
  const ownSite = await read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner_pin",
    siteId: SITE_1,
    permission: PERMISSION.AUDIT_VIEW,
  });
  const otherSite = read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner_pin",
    siteId: SITE_2,
    permission: PERMISSION.AUDIT_VIEW,
  });

  expect(ownSite.events).toEqual([siteOne]);
  await expect(otherSite).rejects.toBeInstanceOf(AuditReadDenied);
});

it("given a copied role named auditor without audit.view, when that session reads the company, then it is denied", async () => {
  const authorizations = new InMemoryAuthorizationRepository();
  const sessions = new InMemorySessionReader();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({ assignmentId: "assignment_owner", userId: OWNER_ID });
  authorization.copyRole({ roleId: "auditor", sourceRoleId: "cashier", actorUserId: OWNER_ID, at: 0 });
  authorization.assign({ assignmentId: "assignment_copy", userId: "user_copy", roleId: "auditor", scopeKind: "company", scopeId: TENANT_ID, validFrom: null, validUntil: null, actorUserId: OWNER_ID, at: 0 });
  await authorizations.save(authorization, { before: Authorization.open(TENANT_ID).snapshot(), after: authorization.snapshot() });
  sessions.put(TENANT_ID, { sessionId: "session_copy", userId: "user_copy", displayName: "copy", deviceId: "device_phone_1", venueId: null, kind: "administration" });
  const read = new ReadAudit(new InMemoryAuditRepository(), authorizations, sessions, new FakeAuthorizationClock(0));
  await expect(read.execute({ tenantId: TENANT_ID, sessionId: "session_copy", siteId: null, permission: PERMISSION.AUDIT_VIEW })).rejects.toBeInstanceOf(AuditReadDenied);
});

it("given a cashier session, when they read audit.view, then it is denied", async () => {
  const { read } = await openReaders();

  const readAudit = read.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    siteId: SITE_1,
    permission: PERMISSION.AUDIT_VIEW,
  });

  await expect(readAudit).rejects.toBeInstanceOf(AuditReadDenied);
});
