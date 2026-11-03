import { expect, it } from "vitest";

import {
  FakeAuthorizationClock,
  InMemoryIdentityReader,
  InMemorySessionReader,
  MemoryPinVerifier,
} from "#adapters/memory/authorization-doubles.js";
import { FakeClock } from "#adapters/memory/fast-identity-doubles.js";
import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import {
  ForeignPinSession,
  OperateAuthorization,
  PermissionDenied,
  UnknownSession,
} from "#application/operate-authorization/operate-authorization.js";
import { AuditDigest } from "#application/ports/audit-digest.js";
import {
  PinConfirmationLocked,
  PinConfirmationRejected,
} from "#application/ports/pin-verifier.js";
import { RecordAuditEvent } from "#application/record-audit-event/record-audit-event.js";
import {
  Authorization,
  AuthorizerRejected,
  PredefinedRoleRevision,
  SelfAuthorizationDenied,
} from "#domain/authorization.js";
import { LIMIT, PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const OWNER_ID = "user_owner";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const WAITER_ID = "user_waiter";
const SITE_1 = "organization_venue_1";
const SITE_2 = "organization_venue_2";
const AT = 1_700_000_000_000;
const CHECK_ID = "check_1";
const WRONG_PIN = "9753";

class FixedAuditDigest extends AuditDigest {
  override async digest(): Promise<string> {
    return "ab".repeat(32);
  }
}

const harness = (recordAudit?: RecordAuditEvent) => {
  const authorizations = new InMemoryAuthorizationRepository();
  const sessions = new InMemorySessionReader();
  const identities = new InMemoryIdentityReader();
  const pins = new MemoryPinVerifier(
    new Map([
      [OWNER_ID, "1111"],
      [CASHIER_ID, "2222"],
      [SUPERVISOR_ID, "2468"],
    ]),
  );
  const clock = new FakeAuthorizationClock(AT);
  const operate = new OperateAuthorization(
    authorizations,
    sessions,
    identities,
    pins,
    clock,
    recordAudit,
  );

  return { authorizations, sessions, identities, pins, clock, operate };
};

const remember = (identities: InMemoryIdentityReader, userId: string): void => {
  identities.put(TENANT_ID, { userId, active: true });
};

const seat = (
  sessions: InMemorySessionReader,
  session: {
    sessionId: string;
    userId: string;
    deviceId: string;
    venueId: string | null;
    kind: "administration" | "pin";
  },
): void => {
  sessions.put(TENANT_ID, {
    displayName: session.userId,
    ...session,
  });
};

it("given an unknown session, when a role is copied, then nothing is saved", async () => {
  const { authorizations, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, OWNER_ID);
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_missing",
    command: {
      type: "copyRole",
      roleId: "role_copy",
      sourceRoleId: "cashier",
    },
  });

  await expect(act).rejects.toBeInstanceOf(UnknownSession);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given a predefined role, when an owner revises it, then the refusal saves nothing", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, OWNER_ID);
  seat(sessions, {
    sessionId: "session_owner",
    userId: OWNER_ID,
    deviceId: "device_owner",
    venueId: null,
    kind: "administration",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    command: {
      type: "reviseRole",
      roleId: "cashier",
      grants: [{ permission: PERMISSION.SALE_CHARGE, grant: "no" }],
    },
  });

  await expect(act).rejects.toBeInstanceOf(PredefinedRoleRevision);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().customRoles,
  ).toEqual([]);
});

it("given a PIN session at site 1, when it changes site 2, then nothing is saved", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, OWNER_ID);
  seat(sessions, {
    sessionId: "session_owner",
    userId: OWNER_ID,
    deviceId: "device_owner",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    command: {
      type: "setVenueLimit",
      venueId: SITE_2,
      roleId: "shiftSupervisor",
      limit: LIMIT.DISCOUNT_PERCENT,
      cap: 10,
    },
  });

  await expect(act).rejects.toBeInstanceOf(ForeignPinSession);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().venueLimits,
  ).toEqual([]);
});

it("given an administration session with a venue id, when that venue is not an assignment, then the venue is not a grant", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  await authorizations.save(authorization, {
    before: authorization.snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, WAITER_ID);
  seat(sessions, {
    sessionId: "session_waiter",
    userId: WAITER_ID,
    deviceId: "device_waiter",
    venueId: SITE_1,
    kind: "administration",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_waiter",
    command: {
      type: "setBartenderCharge",
      venueId: SITE_1,
      enabled: true,
    },
  });

  await expect(act).rejects.toBeInstanceOf(PermissionDenied);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await authorizations.load(TENANT_ID))?.bartenderCharge(SITE_1)).toBe(
    false,
  );
});

it("given an owner, when they copy cashier, then the change stores before and after", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, OWNER_ID);
  seat(sessions, {
    sessionId: "session_owner",
    userId: OWNER_ID,
    deviceId: "device_owner",
    venueId: null,
    kind: "administration",
  });

  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    command: {
      type: "copyRole",
      roleId: "role_copy",
      sourceRoleId: "cashier",
    },
  });

  const event = (await authorizations.eventsFor(TENANT_ID)).at(-1);
  expect(event?.before.customRoles).toEqual([]);
  expect(event?.after.customRoles.map((role) => role.id)).toEqual([
    "role_copy",
  ]);
});

it("given an owner, when a site limit is lowered, then the owner is notified", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, OWNER_ID);
  seat(sessions, {
    sessionId: "session_owner",
    userId: OWNER_ID,
    deviceId: "device_owner",
    venueId: null,
    kind: "administration",
  });

  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    command: {
      type: "setVenueLimit",
      venueId: SITE_1,
      roleId: "shiftSupervisor",
      limit: LIMIT.DISCOUNT_PERCENT,
      cap: 10,
    },
  });

  const event = (await authorizations.eventsFor(TENANT_ID)).at(-1);
  expect(event?.after.notices).toEqual([
    {
      id: "organization_company_1:notice_1",
      ownerUserId: OWNER_ID,
      kind: "limit",
      occurredAt: AT,
    },
  ]);
});

it("given a cashier over the discount cap, when a supervisor resolves it, then the record stores the request facts", async () => {
  const { authorizations, sessions, identities, operate } = harness();
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
    at: AT,
  });
  authorization.assign({
    assignmentId: "assignment_supervisor",
    userId: SUPERVISOR_ID,
    roleId: "shiftSupervisor",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, CASHIER_ID);
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    deviceId: "device_cashier",
    venueId: SITE_1,
    kind: "pin",
  });
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    command: {
      type: "request",
      requestId: "request_discount",
      permission: PERMISSION.SALE_DISCOUNT,
      venueId: SITE_1,
      value: 10,
      reason: "regular",
      expiresAt: AT + 60_000,
    },
  });

  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_discount",
      pin: "2468",
      shiftId: "shift_1",
      approved: true,
    },
  });

  const resolution = (await authorizations.load(TENANT_ID))?.snapshot()
    .resolutions[0];
  expect(resolution).toMatchObject({
    requesterId: CASHIER_ID,
    authorizerId: SUPERVISOR_ID,
    action: PERMISSION.SALE_DISCOUNT,
    value: 10,
    reason: "regular",
    deviceId: "device_supervisor",
    occurredAt: AT,
    selfAuthorized: false,
  });
});

it("given a discount above the supervisor authorize cap, when that supervisor resolves it, then the request stays pending and nothing new is saved", async () => {
  const { authorizations, sessions, identities, operate } = harness();
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
    at: AT,
  });
  authorization.assign({
    assignmentId: "assignment_supervisor",
    userId: SUPERVISOR_ID,
    roleId: "shiftSupervisor",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, CASHIER_ID);
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    deviceId: "device_cashier",
    venueId: SITE_1,
    kind: "pin",
  });
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    command: {
      type: "request",
      requestId: "request_discount",
      permission: PERMISSION.SALE_DISCOUNT,
      venueId: SITE_1,
      value: 20,
      reason: "regular",
      expiresAt: AT + 60_000,
    },
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_discount",
      pin: "2468",
      shiftId: "shift_1",
      approved: true,
    },
  });

  await expect(act).rejects.toBeInstanceOf(AuthorizerRejected);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  const snapshot = (await authorizations.load(TENANT_ID))?.snapshot();
  expect(snapshot?.resolutions).toEqual([]);
  expect(snapshot?.requests[0]?.status).toBe("pending");
});

it("given a supervisor without the comp authorize grant, when they resolve a comp, then the request stays pending and nothing new is saved", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const opened = Authorization.open(TENANT_ID);
  const authorization = Authorization.restore({
    ...opened.snapshot(),
    assignments: [
      {
        id: "assignment_supervisor",
        userId: SUPERVISOR_ID,
        roleId: "shiftSupervisor",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
    ],
    requests: [
      {
        id: "request_comp",
        requesterId: CASHIER_ID,
        permission: PERMISSION.SALE_COMP,
        venueId: SITE_1,
        value: 1_000,
        reason: "guest",
        expiresAt: AT + 60_000,
        status: "pending",
      },
    ],
  });
  await authorizations.save(authorization, {
    before: opened.snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_comp",
      pin: "2468",
      shiftId: "shift_1",
      approved: true,
    },
  });

  await expect(act).rejects.toBeInstanceOf(AuthorizerRejected);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().resolutions,
  ).toEqual([]);
});

it("given no self-authorization for the shift, when the supervisor enters their own PIN, then it is denied and nothing new is saved", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const opened = Authorization.open(TENANT_ID);
  const authorization = Authorization.restore({
    ...opened.snapshot(),
    assignments: [
      {
        id: "assignment_supervisor",
        userId: SUPERVISOR_ID,
        roleId: "shiftSupervisor",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
    ],
    requests: [
      {
        id: "request_void",
        requesterId: SUPERVISOR_ID,
        permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
        venueId: SITE_1,
        value: 40_000,
        reason: "spilled",
        expiresAt: AT + 60_000,
        status: "pending",
      },
    ],
  });
  await authorizations.save(authorization, {
    before: opened.snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_void",
      pin: "2468",
      shiftId: "shift_1",
      approved: true,
    },
  });

  await expect(act).rejects.toBeInstanceOf(SelfAuthorizationDenied);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().resolutions,
  ).toEqual([]);
});

it("given a sole authorizer and the shift flag, when they resolve their own request, then it is self-authorized and noticed", async () => {
  const { authorizations, sessions, identities, operate } = harness();
  const opened = Authorization.open(TENANT_ID);
  const authorization = Authorization.restore({
    ...opened.snapshot(),
    assignments: [
      {
        id: "assignment_supervisor",
        userId: SUPERVISOR_ID,
        roleId: "shiftSupervisor",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
    ],
    requests: [
      {
        id: "request_void",
        requesterId: SUPERVISOR_ID,
        permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
        venueId: SITE_1,
        value: 40_000,
        reason: "spilled",
        expiresAt: AT + 60_000,
        status: "pending",
      },
    ],
    shiftFlags: [
      {
        id: "shift_flag_1",
        venueId: SITE_1,
        shiftId: "shift_1",
        selfAuthorization: true,
      },
    ],
  });
  await authorizations.save(authorization, {
    before: opened.snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });

  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_void",
      pin: "2468",
      shiftId: "shift_1",
      approved: true,
    },
  });

  const snapshot = (await authorizations.load(TENANT_ID))?.snapshot();
  expect(snapshot?.resolutions[0]).toMatchObject({ selfAuthorized: true });
  expect(snapshot?.notices.map((notice) => notice.kind)).toEqual([
    "self-authorization",
  ]);
});

it("given five failed PIN confirmations, when the supervisor tries again, then the PIN locks and the session remains", async () => {
  const { authorizations, sessions, identities, pins, operate } = harness();
  const opened = Authorization.open(TENANT_ID);
  const authorization = Authorization.restore({
    ...opened.snapshot(),
    assignments: [
      {
        id: "assignment_supervisor",
        userId: SUPERVISOR_ID,
        roleId: "shiftSupervisor",
        scopeKind: "site",
        scopeId: SITE_1,
        validFrom: null,
        validUntil: null,
      },
    ],
    requests: [
      {
        id: "request_void",
        requesterId: CASHIER_ID,
        permission: PERMISSION.SALE_DISCOUNT,
        venueId: SITE_1,
        value: 10,
        reason: "regular",
        expiresAt: AT + 60_000,
        status: "pending",
      },
    ],
  });
  await authorizations.save(authorization, {
    before: opened.snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  const resolve = () =>
    operate.execute({
      tenantId: TENANT_ID,
      sessionId: "session_supervisor",
      command: {
        type: "resolve",
        requestId: "request_void",
        pin: "0000",
        shiftId: "shift_1",
        approved: true,
      },
    });

  await expect(resolve()).rejects.toBeInstanceOf(PinConfirmationRejected);
  await expect(resolve()).rejects.toBeInstanceOf(PinConfirmationRejected);
  await expect(resolve()).rejects.toBeInstanceOf(PinConfirmationRejected);
  await expect(resolve()).rejects.toBeInstanceOf(PinConfirmationRejected);
  await expect(resolve()).rejects.toBeInstanceOf(PinConfirmationLocked);

  expect(pins.isLocked(SUPERVISOR_ID)).toBe(true);
  expect(await sessions.find(TENANT_ID, "session_supervisor")).toMatchObject({
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
  });
  expect(
    (await authorizations.load(TENANT_ID))?.snapshot().resolutions,
  ).toEqual([]);
});

it("given a discount request carrying the target and shift totals, when the supervisor PIN is rejected, then those facts stay on the request and the audit records pin.confirmation-failed without the PIN", async () => {
  const audits = new InMemoryAuditRepository();
  const recordAudit = new RecordAuditEvent(
    audits,
    new FixedAuditDigest(),
    new FakeClock(AT),
  );
  const { authorizations, sessions, identities, operate } = harness(recordAudit);
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
    at: AT,
  });
  authorization.assign({
    assignmentId: "assignment_supervisor",
    userId: SUPERVISOR_ID,
    roleId: "shiftSupervisor",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  remember(identities, CASHIER_ID);
  remember(identities, SUPERVISOR_ID);
  seat(sessions, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    deviceId: "device_cashier",
    venueId: SITE_1,
    kind: "pin",
  });
  seat(sessions, {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    deviceId: "device_supervisor",
    venueId: SITE_1,
    kind: "pin",
  });
  const shiftTotals = { waiterVoidsBeforeKitchen: 2, compShiftCop: 90_000 };
  await operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    command: {
      type: "request",
      requestId: "request_discount",
      permission: PERMISSION.SALE_DISCOUNT,
      venueId: SITE_1,
      targetId: CHECK_ID,
      value: 10,
      reason: "regular",
      expiresAt: AT + 60_000,
      shiftTotals,
    },
  });

  const act = operate.execute({
    tenantId: TENANT_ID,
    sessionId: "session_supervisor",
    command: {
      type: "resolve",
      requestId: "request_discount",
      pin: WRONG_PIN,
      shiftId: "shift_1",
      approved: true,
    },
  });

  await expect(act).rejects.toBeInstanceOf(PinConfirmationRejected);
  const snapshot = (await authorizations.load(TENANT_ID))?.snapshot();
  const stored = await audits.list(TENANT_ID, null);
  expect({
    targetId: snapshot?.requests[0]?.targetId,
    shiftTotals: snapshot?.requests[0]?.shiftTotals,
    status: snapshot?.requests[0]?.status,
    resolutions: snapshot?.resolutions.length,
    action: stored[0]?.action,
    pinStored: JSON.stringify(stored).includes(WRONG_PIN),
  }).toEqual({
    targetId: CHECK_ID,
    shiftTotals,
    status: "pending",
    resolutions: 0,
    action: "pin.confirmation-failed",
    pinStored: false,
  });
});
