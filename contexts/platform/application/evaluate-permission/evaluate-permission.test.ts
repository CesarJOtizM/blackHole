import { expect, it } from "vitest";

import {
  FakeAuthorizationClock,
  InMemoryIdentityReader,
  InMemorySessionReader,
} from "#adapters/memory/authorization-doubles.js";
import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import { EvaluatePermission } from "#application/evaluate-permission/evaluate-permission.js";
import { Authorization } from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const OWNER_ID = "user_owner";
const CASHIER_ID = "user_cashier";
const WAITER_ID = "user_waiter";
const SUPPORT_ID = "user_support";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const SITE_1 = "organization_venue_1";
const HOUR = 60 * 60 * 1000;

const harness = (at: number) => {
  const authorizations = new InMemoryAuthorizationRepository();
  const sessions = new InMemorySessionReader();
  const identities = new InMemoryIdentityReader();
  const clock = new FakeAuthorizationClock(at);
  const evaluatePermission = new EvaluatePermission(
    authorizations,
    sessions,
    identities,
    clock,
  );

  return { authorizations, sessions, identities, clock, evaluatePermission };
};

const target = { kind: "site" as const, id: SITE_1, brandId: null };

it("given a waiter session, when it charges, then the charge is denied and nothing is stored", async () => {
  const { authorizations, sessions, identities, evaluatePermission } =
    harness(HOUR);
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_waiter",
    userId: WAITER_ID,
    roleId: "waiter",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: WAITER_ID, active: true });
  sessions.put(TENANT_ID, {
    sessionId: "session_waiter",
    userId: WAITER_ID,
    displayName: "Waiter",
    deviceId: "device_waiter",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_waiter",
    permission: PERMISSION.SALE_CHARGE,
    target,
    value: null,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given a cashier over a 5 percent cap, when 10 percent is evaluated, then authorization is required and nothing is stored", async () => {
  const { authorizations, sessions, identities, evaluatePermission } =
    harness(HOUR);
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_cashier",
    userId: CASHIER_ID,
    roleId: "cashier",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: CASHIER_ID, active: true });
  sessions.put(TENANT_ID, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: "device_cashier",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    permission: PERMISSION.SALE_DISCOUNT,
    target,
    value: 10,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({
    outcome: "requires_authorization",
    exceededLimit: { code: "discountPercent", cap: 5, unit: "percent" },
    selfAuthorized: false,
  });
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given a 4 hour support grant, when support reads after 1 hour, then it is allowed and recorded", async () => {
  const { authorizations, sessions, identities, evaluatePermission } =
    harness(HOUR);
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.grantSupport({
    grantId: "grant_support",
    actorId: "opaque-support",
    expiresAt: 4 * HOUR,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: SUPPORT_ID, active: true });
  sessions.put(TENANT_ID, {
    sessionId: "session_support",
    userId: SUPPORT_ID,
    displayName: "Support",
    deviceId: "device_support",
    venueId: null,
    kind: "administration",
  });

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_support",
    permission: PERMISSION.AUDIT_VIEW,
    target,
    value: null,
    supportGrantId: "grant_support",
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({ outcome: "allowed", selfAuthorized: false });
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().supportActions,
  ).toEqual([
    {
      id: "support_grant_support_1",
      grantId: "grant_support",
      actorId: SUPPORT_ID,
      permission: PERMISSION.AUDIT_VIEW,
      occurredAt: HOUR,
    },
  ]);
});

it("given an expired support grant, when support reads, then it is denied and the expiry is lazy", async () => {
  const { authorizations, sessions, identities, evaluatePermission } = harness(
    5 * HOUR,
  );
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.grantSupport({
    grantId: "grant_support",
    actorId: "opaque-support",
    expiresAt: 4 * HOUR,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: SUPPORT_ID, active: true });
  sessions.put(TENANT_ID, {
    sessionId: "session_support",
    userId: SUPPORT_ID,
    displayName: "Support",
    deviceId: "device_support",
    venueId: null,
    kind: "administration",
  });

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_support",
    permission: PERMISSION.AUDIT_VIEW,
    target,
    value: null,
    supportGrantId: "grant_support",
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(
    (await authorizations.load(TENANT_ID))?.supportGrant("grant_support"),
  ).toMatchObject({ expired: true });
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().supportActions,
  ).toEqual([]);
});

it("given an inactive user, when they charge, then it is denied and nothing is stored", async () => {
  const { authorizations, sessions, identities, evaluatePermission } =
    harness(HOUR);
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_cashier",
    userId: CASHIER_ID,
    roleId: "cashier",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: CASHIER_ID, active: false });
  sessions.put(TENANT_ID, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: "device_cashier",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    permission: PERMISSION.SALE_CHARGE,
    target,
    value: null,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

const openKitchenChief = async (at: number) => {
  const ready = harness(at);
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_kitchen",
    userId: KITCHEN_CHIEF_ID,
    roleId: "kitchenChief",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await ready.authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  ready.identities.put(TENANT_ID, { userId: KITCHEN_CHIEF_ID, active: true });
  ready.sessions.put(TENANT_ID, {
    sessionId: "session_kitchen",
    userId: KITCHEN_CHIEF_ID,
    displayName: "Kitchen chief",
    deviceId: "device_kitchen",
    venueId: SITE_1,
    kind: "pin",
  });

  return ready;
};

it("given a kitchen chief over the waste cap, when selfAuthorizationAttempt is omitted, then authorization is required and nothing is stored", async () => {
  const { authorizations, evaluatePermission } = await openKitchenChief(HOUR);
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_kitchen",
    permission: PERMISSION.INVENTORY_RECORD_WASTE,
    target,
    value: 45_000,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });

  expect(result).toEqual({
    outcome: "requires_authorization",
    exceededLimit: { code: "wasteCop", cap: 30_000, unit: "cop" },
    selfAuthorized: false,
  });
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given the same chief over the waste cap, when selfAuthorizationAttempt is true, then the attempt is forwarded and the decision is denied", async () => {
  const { authorizations, evaluatePermission } = await openKitchenChief(HOUR);
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const result = await evaluatePermission.execute({
    tenantId: TENANT_ID,
    sessionId: "session_kitchen",
    permission: PERMISSION.INVENTORY_RECORD_WASTE,
    target,
    value: 45_000,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    selfAuthorizationAttempt: true,
  });

  expect(result).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});
