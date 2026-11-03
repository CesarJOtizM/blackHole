import type {
  AuthorizationShiftTotals,
  CustomRoleRecord,
  VenueLimitRecord,
} from "#domain/authorization.js";
import {
  defaultLimit,
  GRANT,
  type Grant,
  grantRank,
  isMatrixRole,
  LIMIT,
  type LimitCode,
  limitUnit,
  type PermissionCode,
  permissionLimit,
  permissionMatrix,
  type ScopeKind,
} from "#domain/permission-catalog.js";

export interface EvaluationAssignment {
  roleId: string;
  scopeKind: ScopeKind;
  scopeId: string;
  validFrom: number | null;
  validUntil: number | null;
}

export interface EvaluationTarget {
  kind: ScopeKind;
  id: string;
  brandId: string | null;
}

export interface ExceededLimit {
  code: LimitCode;
  cap: number;
  unit: "percent" | "cop" | "count";
}

export type Evaluation =
  | { outcome: "allowed"; selfAuthorized: boolean }
  | {
      outcome: "requires_authorization";
      exceededLimit: ExceededLimit | null;
      selfAuthorized: false;
    }
  | { outcome: "denied"; selfAuthorized: false };

export interface EvaluateInput {
  permission: PermissionCode;
  at: number;
  target: EvaluationTarget;
  value: number | null;
  assignments: readonly EvaluationAssignment[];
  customRoles: readonly CustomRoleRecord[];
  venueLimits: readonly VenueLimitRecord[];
  shiftTotals: AuthorizationShiftTotals;
  selfAuthorizationAttempt: boolean;
  shiftSelfAuthorization: boolean;
  authorizerAssignmentCount: number;
  bartenderChargeEnabled: boolean;
}

const denied = (): Evaluation => ({ outcome: "denied", selfAuthorized: false });

export const evaluate = (input: EvaluateInput): Evaluation => {
  const applicable = input.assignments.filter(
    (assignment) =>
      active(assignment, input.at) && covers(assignment, input.target),
  );
  let bestGrant: Grant = GRANT.NO;
  let bestCap: number | null = null;

  for (const assignment of applicable) {
    const grant = grantOf(
      assignment.roleId,
      input.permission,
      input.customRoles,
    );

    if (grantRank(grant) > grantRank(bestGrant)) {
      bestGrant = grant;
      bestCap = capOf(assignment, input);
    } else if (grant === GRANT.WITH_LIMIT && bestGrant === GRANT.WITH_LIMIT) {
      const cap = capOf(assignment, input);

      if (cap !== null && (bestCap === null || cap > bestCap)) {
        bestCap = cap;
      }
    }
  }

  const outcome = decide(input, bestGrant, bestCap);

  if (
    !input.selfAuthorizationAttempt ||
    outcome.outcome !== "requires_authorization"
  ) {
    return outcome;
  }

  if (!input.shiftSelfAuthorization || input.authorizerAssignmentCount !== 1) {
    return denied();
  }

  return { outcome: "allowed", selfAuthorized: true };
};

const decide = (
  input: EvaluateInput,
  grant: Grant,
  cap: number | null,
): Evaluation => {
  if (
    input.permission === "sale.charge" &&
    input.assignments.some((assignment) => assignment.roleId === "bartender") &&
    grant === GRANT.NO &&
    input.bartenderChargeEnabled
  ) {
    return { outcome: "allowed", selfAuthorized: false };
  }

  if (grant === GRANT.NO) {
    return denied();
  }

  if (grant === GRANT.YES) {
    return { outcome: "allowed", selfAuthorized: false };
  }

  if (grant === GRANT.WITH_AUTHORIZATION) {
    return {
      outcome: "requires_authorization",
      exceededLimit: null,
      selfAuthorized: false,
    };
  }

  const limit = permissionLimit[input.permission];

  if (!limit || cap === null) {
    return { outcome: "allowed", selfAuthorized: false };
  }

  const consumed = consumedAmount(limit, input);

  if (consumed <= cap) {
    return { outcome: "allowed", selfAuthorized: false };
  }

  return {
    outcome: "requires_authorization",
    exceededLimit: { code: limit, cap, unit: limitUnit[limit] },
    selfAuthorized: false,
  };
};

const consumedAmount = (limit: LimitCode, input: EvaluateInput): number => {
  if (limit === LIMIT.WAITER_VOID_COUNT) {
    return input.shiftTotals.waiterVoidsBeforeKitchen + (input.value ?? 1);
  }

  if (limit === LIMIT.COMP_SHIFT_COP) {
    return (input.shiftTotals.compShiftCop ?? 0) + (input.value ?? 0);
  }

  return input.value ?? 0;
};

const grantOf = (
  roleId: string,
  permission: PermissionCode,
  customRoles: readonly CustomRoleRecord[],
): Grant => {
  if (isMatrixRole(roleId)) {
    return permissionMatrix[permission][roleId];
  }

  return (
    customRoles
      .find((role) => role.id === roleId)
      ?.grants.find((grant) => grant.permission === permission)?.grant ??
    GRANT.NO
  );
};

const capOf = (
  assignment: EvaluationAssignment,
  input: EvaluateInput,
): number | null => {
  const limit = permissionLimit[input.permission];

  if (!limit) {
    return null;
  }

  const roleCap = isMatrixRole(assignment.roleId)
    ? defaultLimit(limit, assignment.roleId)
    : (input.customRoles
        .find((role) => role.id === assignment.roleId)
        ?.limits.find((item) => item.limit === limit)?.cap ?? null);
  const venueCap =
    input.target.kind === "site"
      ? (input.venueLimits.find(
          (item) =>
            item.venueId === input.target.id &&
            item.roleId === assignment.roleId &&
            item.limit === limit,
        )?.cap ?? null)
      : null;

  if (roleCap === null) {
    return venueCap;
  }

  if (venueCap === null) {
    return roleCap;
  }

  return Math.min(roleCap, venueCap);
};

const active = (assignment: EvaluationAssignment, at: number): boolean =>
  (assignment.validFrom === null || at >= assignment.validFrom) &&
  (assignment.validUntil === null || at < assignment.validUntil);

const covers = (
  assignment: EvaluationAssignment,
  target: EvaluationTarget,
): boolean => {
  if (assignment.scopeKind === "company") {
    return true;
  }

  if (assignment.scopeKind === "brand") {
    if (target.kind === "brand") {
      return target.id === assignment.scopeId;
    }

    return target.kind === "site" && target.brandId === assignment.scopeId;
  }

  return (
    assignment.scopeKind === target.kind && assignment.scopeId === target.id
  );
};
