import { expect, it } from "vitest";

import {
  Authorization,
  AuthorizationAlreadyConsumed,
  LastOwnerRemains,
  LimitRaised,
  PredefinedRoleRevision,
  PrivilegeEscalation,
  ScopeRejected,
} from "#domain/authorization.js";
import { GRANT, LIMIT, PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const OWNER_ID = "user_owner";
const ADMIN_ID = "user_admin";
const WAITER_ID = "user_waiter";
const OWNER_ASSIGNMENT_ID = "assignment_owner";
const ADMIN_ASSIGNMENT_ID = "assignment_admin";
const WAITER_ASSIGNMENT_ID = "assignment_waiter";
const SITE_1 = "organization_venue_1";
const SITE_2 = "organization_venue_2";
const COPY_ID = "role_cashier_copy";
const AT = 1_700_000_000_000;

const opened = (): Authorization => {
  const authorization = Authorization.open(TENANT_ID);

  authorization.appointOwner({
    assignmentId: OWNER_ASSIGNMENT_ID,
    userId: OWNER_ID,
  });

  return authorization;
};

it("given the predefined cashier role, when an owner edits it, then the edit is rejected", () => {
  const authorization = opened();

  const revise = () =>
    authorization.reviseRole({
      roleId: "cashier",
      grants: [{ permission: PERMISSION.SALE_CHARGE, grant: GRANT.NO }],
      actorUserId: OWNER_ID,
      at: AT,
    });

  expect(revise).toThrow(PredefinedRoleRevision);
  expect(authorization.snapshot().customRoles).toEqual([]);
});

it("given a copy of cashier, when the owner changes it, then the copy keeps the change", () => {
  const authorization = opened();

  authorization.copyRole({
    roleId: COPY_ID,
    sourceRoleId: "cashier",
    actorUserId: OWNER_ID,
    at: AT,
  });
  authorization.reviseRole({
    roleId: COPY_ID,
    grants: [{ permission: PERMISSION.SALE_CHARGE, grant: GRANT.NO }],
    actorUserId: OWNER_ID,
    at: AT,
  });

  expect(authorization.roleGrant(COPY_ID, PERMISSION.SALE_CHARGE)).toBe(
    GRANT.NO,
  );
  expect(authorization.snapshot().notices.map((notice) => notice.kind)).toEqual(
    ["role", "role"],
  );
});

it("given a company discount cap of 15 percent, when a site sets 20, then the raise is rejected", () => {
  const authorization = opened();

  const raise = () =>
    authorization.setVenueLimit({
      venueId: SITE_1,
      roleId: "shiftSupervisor",
      limit: LIMIT.DISCOUNT_PERCENT,
      cap: 20,
      actorUserId: OWNER_ID,
      at: AT,
    });

  expect(raise).toThrow(LimitRaised);
  expect(authorization.snapshot().venueLimits).toEqual([]);
});

it("given a company discount cap of 15 percent, when a site sets 10, then the lower cap is kept", () => {
  const authorization = opened();

  authorization.setVenueLimit({
    venueId: SITE_1,
    roleId: "shiftSupervisor",
    limit: LIMIT.DISCOUNT_PERCENT,
    cap: 10,
    actorUserId: OWNER_ID,
    at: AT,
  });

  expect(
    authorization.venueLimit(SITE_1, "shiftSupervisor", LIMIT.DISCOUNT_PERCENT),
  ).toBe(10);
  expect(authorization.snapshot().notices.map((notice) => notice.kind)).toEqual(
    ["limit"],
  );
});

it("given one active owner, when that owner is removed, then the removal is rejected", () => {
  const authorization = opened();

  const remove = () =>
    authorization.removeAssignment({
      assignmentId: OWNER_ASSIGNMENT_ID,
      actorUserId: OWNER_ID,
      at: AT,
    });

  expect(remove).toThrow(LastOwnerRemains);
  expect(authorization.snapshot().assignments).toHaveLength(1);
});

it("given an administrator without recipe edit, when they create a role that includes it, then the role is rejected", () => {
  const authorization = opened();

  authorization.assign({
    assignmentId: ADMIN_ASSIGNMENT_ID,
    userId: ADMIN_ID,
    roleId: "siteAdministrator",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  const escalate = () =>
    authorization.copyRole({
      roleId: "role_recipes",
      sourceRoleId: "owner",
      actorUserId: ADMIN_ID,
      at: AT,
    });

  expect(escalate).toThrow(PrivilegeEscalation);
  expect(authorization.snapshot().customRoles).toEqual([]);
});

it("given an administrator of site 1, when they assign a role in site 2, then the assignment is rejected", () => {
  const authorization = opened();

  authorization.assign({
    assignmentId: ADMIN_ASSIGNMENT_ID,
    userId: ADMIN_ID,
    roleId: "siteAdministrator",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  const assign = () =>
    authorization.assign({
      assignmentId: WAITER_ASSIGNMENT_ID,
      userId: WAITER_ID,
      roleId: "waiter",
      scopeKind: "site",
      scopeId: SITE_2,
      validFrom: null,
      validUntil: null,
      actorUserId: ADMIN_ID,
      at: AT,
    });

  expect(assign).toThrow(ScopeRejected);
  expect(
    authorization.snapshot().assignments.map((assignment) => assignment.userId),
  ).toEqual([OWNER_ID, ADMIN_ID]);
});

it("given a venue, when bartender charging is read, then the flag starts off", () => {
  const authorization = opened();

  const enabled = authorization.bartenderCharge(SITE_1);

  expect(enabled).toBe(false);
});

const ACCOUNT_A = "account_a";
const ACCOUNT_B = "account_b";
const DISCOUNT_REQUEST_ID = "request_discount";
const SHIFT_TOTALS = { waiterVoidsBeforeKitchen: 0, compShiftCop: 0 };

const approvedDiscount = (): Authorization => {
  const authorization = opened();

  authorization.requestAuthorization({
    requestId: DISCOUNT_REQUEST_ID,
    requesterId: "user_cashier",
    permission: PERMISSION.SALE_DISCOUNT,
    venueId: SITE_1,
    targetId: ACCOUNT_A,
    value: 10,
    reason: "guest",
    expiresAt: AT + 60_000,
    shiftTotals: SHIFT_TOTALS,
  });
  authorization.resolveAuthorization({
    requestId: DISCOUNT_REQUEST_ID,
    authorizerId: OWNER_ID,
    deviceId: "device_owner",
    shiftId: "shift_1",
    at: AT,
    approved: true,
    authorizerAssignmentCount: 1,
  });

  return authorization;
};

const consumeDiscount = (
  authorization: Authorization,
  input: {
    targetId?: string;
    value?: number;
    permission?: "sale.discount" | "sale.comp";
  } = {},
) =>
  authorization.consumeAuthorization({
    requestId: DISCOUNT_REQUEST_ID,
    permission: input.permission ?? PERMISSION.SALE_DISCOUNT,
    targetId: input.targetId ?? ACCOUNT_A,
    value: input.value ?? 10,
    at: AT + 1,
  });

it("given an approved discount on account A, when the request is read, then it keeps that target and the shift totals", () => {
  const authorization = approvedDiscount();

  const request = authorization.snapshot().requests[0];

  expect(request).toMatchObject({
    targetId: ACCOUNT_A,
    shiftTotals: SHIFT_TOTALS,
    consumedAt: null,
  });
});

it("given an approved discount of 10 percent on account A, when that discount is consumed, then the grant is consumed once", () => {
  const authorization = approvedDiscount();

  const consumed = consumeDiscount(authorization);

  expect(consumed).toBe(true);
  expect(authorization.snapshot().requests[0]?.consumedAt).toBe(AT + 1);
});

it("given an approved discount of 10 percent on account A, when 20 percent is consumed, then the grant stays unconsumed", () => {
  const authorization = approvedDiscount();

  const consumed = consumeDiscount(authorization, { value: 20 });

  expect(consumed).toBe(false);
  expect(authorization.snapshot().requests[0]?.consumedAt).toBeNull();
});

it("given an approved discount on account A, when account B is consumed, then the grant stays unconsumed", () => {
  const authorization = approvedDiscount();

  const consumed = consumeDiscount(authorization, { targetId: ACCOUNT_B });

  expect(consumed).toBe(false);
  expect(authorization.snapshot().requests[0]?.consumedAt).toBeNull();
});

it("given an approved discount, when another action is consumed, then the grant stays unconsumed", () => {
  const authorization = approvedDiscount();

  const consumed = consumeDiscount(authorization, {
    permission: PERMISSION.SALE_COMP,
  });

  expect(consumed).toBe(false);
  expect(authorization.snapshot().requests[0]?.consumedAt).toBeNull();
});

it("given a consumed discount, when it is consumed again, then the second consume is rejected", () => {
  const authorization = approvedDiscount();
  consumeDiscount(authorization);

  const again = () => consumeDiscount(authorization, {});

  expect(again).toThrow(AuthorizationAlreadyConsumed);
  expect(authorization.snapshot().requests[0]?.consumedAt).toBe(AT + 1);
});

it("given an administrator with 90000 courtesy already used, when the company evaluates another 20000, then authorization is required", () => {
  const authorization = opened();

  authorization.assign({
    assignmentId: ADMIN_ASSIGNMENT_ID,
    userId: ADMIN_ID,
    roleId: "siteAdministrator",
    scopeKind: "site",
    scopeId: SITE_1,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: AT,
  });
  const result = authorization.evaluateFor(ADMIN_ID, {
    permission: PERMISSION.SALE_COMP,
    at: AT,
    target: { kind: "site", id: SITE_1, brandId: null },
    value: 20_000,
    shiftTotals: { waiterVoidsBeforeKitchen: 0, compShiftCop: 90_000 },
    selfAuthorizationAttempt: false,
    shiftId: null,
  });

  expect(result).toEqual({
    outcome: "requires_authorization",
    exceededLimit: { code: "compShiftCop", cap: 100_000, unit: "cop" },
    selfAuthorized: false,
  });
});
