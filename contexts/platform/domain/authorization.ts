import { type Evaluation, evaluate } from "#domain/evaluate.js";
import {
  authorizeGrant,
  BARTENDER_CHARGE_DEFAULT,
  defaultLimit,
  GRANT,
  type Grant,
  grantRank,
  isMatrixRole,
  type LimitCode,
  MATRIX_ROLE,
  type MatrixRole,
  type PermissionCode,
  permissionCodes,
  permissionLimit,
  permissionMatrix,
  type ScopeKind,
} from "#domain/permission-catalog.js";

export interface RoleGrantRecord {
  permission: PermissionCode;
  grant: Grant;
}

export interface RoleLimitRecord {
  limit: LimitCode;
  cap: number;
}

export interface CustomRoleRecord {
  id: string;
  sourceRoleId: string;
  grants: readonly RoleGrantRecord[];
  limits: readonly RoleLimitRecord[];
}

export interface AssignmentRecord {
  id: string;
  userId: string;
  roleId: string;
  scopeKind: ScopeKind;
  scopeId: string;
  validFrom: number | null;
  validUntil: number | null;
}

export interface VenueLimitRecord {
  venueId: string;
  roleId: string;
  limit: LimitCode;
  cap: number;
}

export interface BartenderFlagRecord {
  venueId: string;
  enabled: boolean;
}

export interface AuthorizationShiftTotals {
  waiterVoidsBeforeKitchen: number;
  compShiftCop?: number;
}

export interface AuthorizationRequestRecord {
  id: string;
  requesterId: string;
  permission: PermissionCode;
  venueId: string;
  targetId?: string;
  value: number | null;
  reason: string;
  expiresAt: number;
  status: "pending" | "resolved" | "expired";
  shiftTotals?: AuthorizationShiftTotals;
  consumedAt?: number | null;
}

export interface ResolutionRecord {
  id: string;
  requestId: string;
  requesterId: string;
  authorizerId: string;
  action: PermissionCode;
  value: number | null;
  reason: string;
  deviceId: string;
  occurredAt: number;
  selfAuthorized: boolean;
  approved: boolean;
}

export interface SupportGrantRecord {
  id: string;
  actorId: string;
  expiresAt: number;
  expired: boolean;
  revoked: boolean;
}

export interface SupportActionRecord {
  id: string;
  grantId: string;
  actorId: string;
  permission: PermissionCode;
  occurredAt: number;
}

export interface ShiftFlagRecord {
  id: string;
  venueId: string;
  shiftId: string;
  selfAuthorization: boolean;
}

export interface NoticeRecord {
  id: string;
  ownerUserId: string;
  kind: "role" | "limit" | "self-authorization";
  occurredAt: number;
}

export interface AuthorizationSnapshot {
  tenantId: string;
  customRoles: readonly CustomRoleRecord[];
  assignments: readonly AssignmentRecord[];
  venueLimits: readonly VenueLimitRecord[];
  bartenderCharge: readonly BartenderFlagRecord[];
  requests: readonly AuthorizationRequestRecord[];
  resolutions: readonly ResolutionRecord[];
  supportGrants: readonly SupportGrantRecord[];
  supportActions: readonly SupportActionRecord[];
  shiftFlags: readonly ShiftFlagRecord[];
  notices: readonly NoticeRecord[];
}

interface AppointOwner {
  assignmentId: string;
  userId: string;
}

interface CopyRole {
  roleId: string;
  sourceRoleId: string;
  actorUserId: string;
  at: number;
}

interface ReviseRole {
  roleId: string;
  grants: readonly RoleGrantRecord[];
  actorUserId: string;
  at: number;
}

interface SetVenueLimit {
  venueId: string;
  roleId: string;
  limit: LimitCode;
  cap: number;
  actorUserId: string;
  at: number;
}

interface AssignRole {
  assignmentId: string;
  userId: string;
  roleId: string;
  scopeKind: ScopeKind;
  scopeId: string;
  validFrom: number | null;
  validUntil: number | null;
  actorUserId: string;
  at: number;
}

interface RemoveAssignment {
  assignmentId: string;
  actorUserId: string;
  at: number;
}

interface SetBartenderCharge {
  venueId: string;
  enabled: boolean;
  actorUserId: string;
  at: number;
}

interface EnableShiftSelfAuthorization {
  id: string;
  venueId: string;
  shiftId: string;
  enabled: boolean;
  actorUserId: string;
  at: number;
}

interface RequestAuthorization {
  requestId: string;
  requesterId: string;
  permission: PermissionCode;
  venueId: string;
  targetId?: string;
  value: number | null;
  reason: string;
  expiresAt: number;
  shiftTotals?: AuthorizationShiftTotals;
}

interface ConsumeAuthorization {
  requestId: string;
  permission: PermissionCode;
  targetId: string;
  value: number | null;
  at: number;
}

interface ResolveAuthorization {
  requestId: string;
  authorizerId: string;
  deviceId: string;
  shiftId: string;
  at: number;
  approved: boolean;
  authorizerAssignmentCount: number;
}

interface GrantSupport {
  grantId: string;
  actorId: string;
  expiresAt: number;
  actorUserId: string;
  at: number;
}

interface CoverageTarget {
  kind: ScopeKind;
  id: string;
  brandId: string | null;
}

interface EffectiveGrants {
  grants: Map<PermissionCode, Grant>;
  caps: Map<LimitCode, number>;
}

const emptyEffective = (): EffectiveGrants => ({
  grants: new Map(permissionCodes.map((permission) => [permission, GRANT.NO])),
  caps: new Map(),
});

export class PredefinedRoleRevision extends Error {
  constructor() {
    super("A predefined role cannot be edited.");
    this.name = "PredefinedRoleRevision";
  }
}

export class LimitRaised extends Error {
  constructor() {
    super("A site can only lower a company limit.");
    this.name = "LimitRaised";
  }
}

export class LastOwnerRemains extends Error {
  constructor() {
    super("The last active owner stays.");
    this.name = "LastOwnerRemains";
  }
}

export class PrivilegeEscalation extends Error {
  constructor() {
    super("A role cannot exceed the actor's permissions or limits.");
    this.name = "PrivilegeEscalation";
  }
}

export class ScopeRejected extends Error {
  constructor() {
    super("The actor cannot assign outside their scope.");
    this.name = "ScopeRejected";
  }
}

export class SelfAuthorizationDenied extends Error {
  constructor() {
    super("Self-authorization needs the shift flag and a sole authorizer.");
    this.name = "SelfAuthorizationDenied";
  }
}

export class AuthorizerRejected extends Error {
  constructor() {
    super("The authorizer permission does not cover the value.");
    this.name = "AuthorizerRejected";
  }
}

export class UnknownAuthorizationReference extends Error {
  constructor() {
    super("The authorization does not include that reference.");
    this.name = "UnknownAuthorizationReference";
  }
}

export class DuplicateAuthorizationId extends Error {
  constructor() {
    super("That authorization identifier is already in use.");
    this.name = "DuplicateAuthorizationId";
  }
}

export class ReasonRequired extends Error {
  constructor() {
    super("An authorization request needs a reason.");
    this.name = "ReasonRequired";
  }
}

export class RequestExpired extends Error {
  constructor() {
    super("The authorization request expired.");
    this.name = "RequestExpired";
  }
}

export class AuthorizationAlreadyConsumed extends Error {
  constructor() {
    super("The authorization was already consumed.");
    this.name = "AuthorizationAlreadyConsumed";
  }
}

export class Authorization {
  readonly tenantId: string;

  private customRoleList: CustomRoleRecord[] = [];
  private assignmentList: AssignmentRecord[] = [];
  private venueLimitList: VenueLimitRecord[] = [];
  private bartenderFlagList: BartenderFlagRecord[] = [];
  private requestList: AuthorizationRequestRecord[] = [];
  private resolutionList: ResolutionRecord[] = [];
  private supportGrantList: SupportGrantRecord[] = [];
  private supportActionList: SupportActionRecord[] = [];
  private shiftFlagList: ShiftFlagRecord[] = [];
  private noticeList: NoticeRecord[] = [];

  private constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static open(tenantId: string): Authorization {
    return new Authorization(tenantId);
  }

  static restore(snapshot: AuthorizationSnapshot): Authorization {
    const authorization = new Authorization(snapshot.tenantId);
    authorization.customRoleList = snapshot.customRoles.map(copyRole);
    authorization.assignmentList = snapshot.assignments.map((assignment) => ({
      ...assignment,
    }));
    authorization.venueLimitList = snapshot.venueLimits.map((limit) => ({
      ...limit,
    }));
    authorization.bartenderFlagList = snapshot.bartenderCharge.map((flag) => ({
      ...flag,
    }));
    authorization.requestList = snapshot.requests.map((request) =>
      completeRequest(request),
    );
    authorization.resolutionList = snapshot.resolutions.map((resolution) => ({
      ...resolution,
    }));
    authorization.supportGrantList = snapshot.supportGrants.map((grant) => ({
      ...grant,
    }));
    authorization.supportActionList = snapshot.supportActions.map((action) => ({
      ...action,
    }));
    authorization.shiftFlagList = snapshot.shiftFlags.map((flag) => ({
      ...flag,
    }));
    authorization.noticeList = snapshot.notices.map((notice) => ({
      ...notice,
    }));

    return authorization;
  }

  snapshot(): AuthorizationSnapshot {
    return {
      tenantId: this.tenantId,
      customRoles: this.customRoleList.map(copyRole),
      assignments: this.assignmentList.map((assignment) => ({ ...assignment })),
      venueLimits: this.venueLimitList.map((limit) => ({ ...limit })),
      bartenderCharge: this.bartenderFlagList.map((flag) => ({ ...flag })),
      requests: this.requestList.map((request) => completeRequest(request)),
      resolutions: this.resolutionList.map((resolution) => ({ ...resolution })),
      supportGrants: this.supportGrantList.map((grant) => ({ ...grant })),
      supportActions: this.supportActionList.map((action) => ({ ...action })),
      shiftFlags: this.shiftFlagList.map((flag) => ({ ...flag })),
      notices: this.noticeList.map((notice) => ({ ...notice })),
    };
  }

  appointOwner(input: AppointOwner): void {
    this.reserve(input.assignmentId);
    this.assignmentList.push({
      id: input.assignmentId,
      userId: input.userId,
      roleId: MATRIX_ROLE.OWNER,
      scopeKind: "company",
      scopeId: this.tenantId,
      validFrom: null,
      validUntil: null,
    });
  }

  copyRole(input: CopyRole): void {
    this.reserve(input.roleId);
    const source = this.materialize(input.sourceRoleId);
    this.assertSubset(
      input.actorUserId,
      source.grants,
      source.limits,
      input.at,
    );
    this.customRoleList.push({
      id: input.roleId,
      sourceRoleId: input.sourceRoleId,
      grants: source.grants,
      limits: source.limits,
    });
    this.notify("role", input.at);
  }

  reviseRole(input: ReviseRole): void {
    if (isMatrixRole(input.roleId)) {
      throw new PredefinedRoleRevision();
    }

    const role = this.customRoleList.find((item) => item.id === input.roleId);

    if (!role) {
      throw new UnknownAuthorizationReference();
    }

    const grants = mergeGrants(role.grants, input.grants);
    this.assertSubset(input.actorUserId, grants, role.limits, input.at);
    role.grants = grants;
    this.notify("role", input.at);
  }

  setVenueLimit(input: SetVenueLimit): void {
    this.assertCovers(input.actorUserId, "site", input.venueId, input.at);
    const companyCap = this.companyCap(input.roleId, input.limit);

    if (companyCap !== null && input.cap > companyCap) {
      throw new LimitRaised();
    }

    const existing = this.venueLimitList.find(
      (limit) =>
        limit.venueId === input.venueId &&
        limit.roleId === input.roleId &&
        limit.limit === input.limit,
    );

    if (existing) {
      existing.cap = input.cap;
    } else {
      this.venueLimitList.push({
        venueId: input.venueId,
        roleId: input.roleId,
        limit: input.limit,
        cap: input.cap,
      });
    }

    this.notify("limit", input.at);
  }

  assign(input: AssignRole): void {
    this.reserve(input.assignmentId);
    this.assertCovers(
      input.actorUserId,
      input.scopeKind,
      input.scopeId,
      input.at,
    );
    const role = this.materialize(input.roleId);
    this.assertSubset(input.actorUserId, role.grants, role.limits, input.at);
    this.assignmentList.push({
      id: input.assignmentId,
      userId: input.userId,
      roleId: input.roleId,
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    });
  }

  removeAssignment(input: RemoveAssignment): void {
    const assignment = this.assignmentList.find(
      (item) => item.id === input.assignmentId,
    );

    if (!assignment) {
      throw new UnknownAuthorizationReference();
    }

    this.assertCovers(
      input.actorUserId,
      assignment.scopeKind,
      assignment.scopeId,
      input.at,
    );

    if (
      assignment.roleId === MATRIX_ROLE.OWNER &&
      this.assignmentList.filter((item) => item.roleId === MATRIX_ROLE.OWNER)
        .length === 1
    ) {
      throw new LastOwnerRemains();
    }

    this.assignmentList = this.assignmentList.filter(
      (item) => item.id !== assignment.id,
    );
  }

  setBartenderCharge(input: SetBartenderCharge): void {
    this.assertCovers(input.actorUserId, "site", input.venueId, input.at);
    const existing = this.bartenderFlagList.find(
      (flag) => flag.venueId === input.venueId,
    );

    if (existing) {
      existing.enabled = input.enabled;
      return;
    }

    this.bartenderFlagList.push({
      venueId: input.venueId,
      enabled: input.enabled,
    });
  }

  enableShiftSelfAuthorization(input: EnableShiftSelfAuthorization): void {
    this.reserve(input.id);
    this.assertCovers(input.actorUserId, "site", input.venueId, input.at);
    this.shiftFlagList.push({
      id: input.id,
      venueId: input.venueId,
      shiftId: input.shiftId,
      selfAuthorization: input.enabled,
    });
  }

  requestAuthorization(input: RequestAuthorization): void {
    if (input.reason.trim().length === 0) {
      throw new ReasonRequired();
    }

    this.reserve(input.requestId);
    this.requestList.push(
      completeRequest({
        id: input.requestId,
        requesterId: input.requesterId,
        permission: input.permission,
        venueId: input.venueId,
        targetId: input.targetId,
        value: input.value,
        reason: input.reason,
        expiresAt: input.expiresAt,
        status: "pending",
        shiftTotals: input.shiftTotals,
        consumedAt: null,
      }),
    );
  }

  consumeAuthorization(input: ConsumeAuthorization): boolean {
    const request = this.requestList.find(
      (item) => item.id === input.requestId,
    );

    if (!request) {
      throw new UnknownAuthorizationReference();
    }

    const approved = this.resolutionList.some(
      (item) => item.requestId === request.id && item.approved,
    );
    const matches =
      approved &&
      request.permission === input.permission &&
      (request.targetId ?? request.venueId) === input.targetId &&
      request.value === input.value;

    if (!matches) {
      return false;
    }

    if (typeof request.consumedAt === "number") {
      throw new AuthorizationAlreadyConsumed();
    }

    request.consumedAt = input.at;

    return true;
  }

  resolveAuthorization(input: ResolveAuthorization): void {
    const request = this.requestList.find(
      (item) => item.id === input.requestId,
    );

    if (!request || request.status !== "pending") {
      throw new UnknownAuthorizationReference();
    }

    if (input.at >= request.expiresAt) {
      throw new RequestExpired();
    }

    this.assertAuthorizerCovers(
      input.authorizerId,
      request.permission,
      request.venueId,
      request.value,
      input.at,
    );

    const selfRequest = input.authorizerId === request.requesterId;
    let selfAuthorized = false;

    if (selfRequest) {
      const flag = this.shiftFlagList.find(
        (item) =>
          item.venueId === request.venueId && item.shiftId === input.shiftId,
      );

      if (
        flag?.selfAuthorization !== true ||
        input.authorizerAssignmentCount !== 1
      ) {
        throw new SelfAuthorizationDenied();
      }

      selfAuthorized = true;
      this.notify("self-authorization", input.at);
    }

    request.status = "resolved";
    this.resolutionList.push({
      id: `resolution_${request.id}`,
      requestId: request.id,
      requesterId: request.requesterId,
      authorizerId: input.authorizerId,
      action: request.permission,
      value: request.value,
      reason: request.reason,
      deviceId: input.deviceId,
      occurredAt: input.at,
      selfAuthorized,
      approved: input.approved,
    });
  }

  grantSupport(input: GrantSupport): void {
    this.assertOwner(input.actorUserId, input.at);
    this.reserve(input.grantId);
    this.supportGrantList.push({
      id: input.grantId,
      actorId: input.actorId,
      expiresAt: input.expiresAt,
      expired: false,
      revoked: false,
    });
  }

  revokeSupport(grantId: string): void {
    const grant = this.supportGrantList.find((item) => item.id === grantId);

    if (!grant) {
      throw new UnknownAuthorizationReference();
    }

    grant.revoked = true;
  }

  expireSupportGrant(grantId: string, at: number): boolean {
    const grant = this.supportGrantList.find((item) => item.id === grantId);

    if (!grant || grant.revoked || grant.expired || at < grant.expiresAt) {
      return false;
    }

    grant.expired = true;

    return true;
  }

  recordSupportAction(input: {
    id: string;
    grantId: string;
    actorId: string;
    permission: PermissionCode;
    occurredAt: number;
  }): void {
    this.supportActionList.push({ ...input });
  }

  supportGrant(grantId: string): SupportGrantRecord | null {
    const grant = this.supportGrantList.find((item) => item.id === grantId);

    return grant ? { ...grant } : null;
  }

  roleGrant(roleId: string, permission: PermissionCode): Grant {
    return (
      this.materialize(roleId).grants.find(
        (grant) => grant.permission === permission,
      )?.grant ?? GRANT.NO
    );
  }

  venueLimit(venueId: string, roleId: string, limit: LimitCode): number | null {
    return (
      this.venueLimitList.find(
        (item) =>
          item.venueId === venueId &&
          item.roleId === roleId &&
          item.limit === limit,
      )?.cap ?? null
    );
  }

  bartenderCharge(venueId: string): boolean {
    return (
      this.bartenderFlagList.find((flag) => flag.venueId === venueId)
        ?.enabled ?? BARTENDER_CHARGE_DEFAULT
    );
  }

  canManage(userId: string, at: number): boolean {
    const held =
      this.effective(userId, at).grants.get("identity.assign-role") ?? GRANT.NO;

    return held === GRANT.YES || held === GRANT.WITH_LIMIT;
  }

  heldGrant(
    userId: string,
    permission: PermissionCode,
    target: CoverageTarget,
    at: number,
  ): Grant {
    return (
      this.effective(userId, at, target).grants.get(permission) ?? GRANT.NO
    );
  }

  authorizerCount(
    permission: PermissionCode,
    venueId: string,
    at: number,
  ): number {
    const target: CoverageTarget = { kind: "site", id: venueId, brandId: null };

    return this.assignmentList.filter((assignment) => {
      if (!covers(assignment, target, at)) {
        return false;
      }

      const grant = authorizeGrant(
        this.roleGrant(assignment.roleId, permission),
      );

      return grant === GRANT.YES || grant === GRANT.WITH_LIMIT;
    }).length;
  }

  evaluateFor(
    userId: string,
    input: {
      permission: PermissionCode;
      at: number;
      target: CoverageTarget;
      value: number | null;
      shiftTotals: AuthorizationShiftTotals;
      selfAuthorizationAttempt: boolean;
      shiftId: string | null;
    },
  ): Evaluation {
    const shift = this.shiftFlagList.find(
      (flag) =>
        flag.venueId === input.target.id && flag.shiftId === input.shiftId,
    );

    return evaluate({
      permission: input.permission,
      at: input.at,
      target: input.target,
      value: input.value,
      assignments: this.assignmentList
        .filter((assignment) => assignment.userId === userId)
        .map((assignment) => ({ ...assignment })),
      customRoles: this.customRoleList.map(copyRole),
      venueLimits: this.venueLimitList.map((limit) => ({ ...limit })),
      shiftTotals: input.shiftTotals,
      selfAuthorizationAttempt: input.selfAuthorizationAttempt,
      shiftSelfAuthorization: shift?.selfAuthorization ?? false,
      authorizerAssignmentCount: this.authorizerCount(
        input.permission,
        input.target.id,
        input.at,
      ),
      bartenderChargeEnabled: this.bartenderCharge(input.target.id),
    });
  }

  private reserve(id: string): void {
    const taken = [
      ...this.customRoleList.map((role) => role.id),
      ...this.assignmentList.map((assignment) => assignment.id),
      ...this.requestList.map((request) => request.id),
      ...this.supportGrantList.map((grant) => grant.id),
      ...this.shiftFlagList.map((flag) => flag.id),
    ];

    if (taken.includes(id)) {
      throw new DuplicateAuthorizationId();
    }
  }

  private materialize(roleId: string): {
    grants: RoleGrantRecord[];
    limits: RoleLimitRecord[];
  } {
    if (isMatrixRole(roleId)) {
      return matrixRole(roleId);
    }

    const custom = this.customRoleList.find((role) => role.id === roleId);

    if (!custom) {
      throw new UnknownAuthorizationReference();
    }

    return {
      grants: custom.grants.map((grant) => ({ ...grant })),
      limits: custom.limits.map((limit) => ({ ...limit })),
    };
  }

  private companyCap(roleId: string, limit: LimitCode): number | null {
    if (isMatrixRole(roleId)) {
      return defaultLimit(limit, roleId);
    }

    return (
      this.customRoleList
        .find((role) => role.id === roleId)
        ?.limits.find((item) => item.limit === limit)?.cap ?? null
    );
  }

  private assertSubset(
    actorUserId: string,
    grants: readonly RoleGrantRecord[],
    limits: readonly RoleLimitRecord[],
    at: number,
  ): void {
    const actor = this.effective(actorUserId, at);

    for (const grant of grants) {
      const held = actor.grants.get(grant.permission) ?? GRANT.NO;

      if (grantRank(grant.grant) > grantRank(held)) {
        throw new PrivilegeEscalation();
      }

      if (grant.grant !== GRANT.WITH_LIMIT || held !== GRANT.WITH_LIMIT) {
        continue;
      }

      const limit = permissionLimit[grant.permission];

      if (!limit) {
        continue;
      }

      const actorCap = actor.caps.get(limit);
      const roleCap = limits.find((item) => item.limit === limit)?.cap;

      if (
        actorCap === undefined ||
        roleCap === undefined ||
        roleCap > actorCap
      ) {
        throw new PrivilegeEscalation();
      }
    }
  }

  private assertCovers(
    actorUserId: string,
    scopeKind: ScopeKind,
    scopeId: string,
    at: number,
  ): void {
    const target: CoverageTarget = {
      kind: scopeKind,
      id: scopeId,
      brandId: null,
    };
    const covered = this.assignmentList.some(
      (assignment) =>
        assignment.userId === actorUserId && covers(assignment, target, at),
    );

    if (!covered) {
      throw new ScopeRejected();
    }
  }

  private assertAuthorizerCovers(
    userId: string,
    permission: PermissionCode,
    venueId: string,
    value: number | null,
    at: number,
  ): void {
    const target: CoverageTarget = { kind: "site", id: venueId, brandId: null };
    let unlimited = false;
    let bestCap: number | null = null;

    for (const assignment of this.assignmentList) {
      if (assignment.userId !== userId || !covers(assignment, target, at)) {
        continue;
      }

      const grant = authorizeGrant(
        this.roleGrant(assignment.roleId, permission),
      );

      if (grant === GRANT.YES) {
        unlimited = true;
        break;
      }

      if (grant !== GRANT.WITH_LIMIT) {
        continue;
      }

      const cap = this.assignmentCap(assignment.roleId, permission, venueId);

      if (cap === null) {
        unlimited = true;
        break;
      }

      if (bestCap === null || cap > bestCap) {
        bestCap = cap;
      }
    }

    if (
      unlimited ||
      (bestCap !== null && (value === null || value <= bestCap))
    ) {
      return;
    }

    throw new AuthorizerRejected();
  }

  private assignmentCap(
    roleId: string,
    permission: PermissionCode,
    venueId: string,
  ): number | null {
    const limit = permissionLimit[permission];

    if (!limit) {
      return null;
    }

    const roleCap = this.companyCap(roleId, limit);
    const venueCap = this.venueLimit(venueId, roleId, limit);

    if (roleCap === null) {
      return venueCap;
    }

    if (venueCap === null) {
      return roleCap;
    }

    return Math.min(roleCap, venueCap);
  }

  private assertOwner(actorUserId: string, at: number): void {
    const owner = this.assignmentList.some(
      (assignment) =>
        assignment.userId === actorUserId &&
        assignment.roleId === MATRIX_ROLE.OWNER &&
        active(assignment, at),
    );

    if (!owner) {
      throw new PrivilegeEscalation();
    }
  }

  private effective(
    userId: string,
    at: number,
    target?: CoverageTarget,
  ): EffectiveGrants {
    const effective = emptyEffective();

    for (const assignment of this.assignmentList) {
      if (assignment.userId !== userId || !active(assignment, at)) {
        continue;
      }

      if (target && !covers(assignment, target, at)) {
        continue;
      }

      const role = this.materialize(assignment.roleId);

      for (const grant of role.grants) {
        const current = effective.grants.get(grant.permission) ?? GRANT.NO;

        if (grantRank(grant.grant) > grantRank(current)) {
          effective.grants.set(grant.permission, grant.grant);
        }
      }

      for (const limit of role.limits) {
        const current = effective.caps.get(limit.limit);

        if (current === undefined || limit.cap > current) {
          effective.caps.set(limit.limit, limit.cap);
        }
      }
    }

    return effective;
  }

  private notify(kind: NoticeRecord["kind"], at: number): void {
    const owner = this.assignmentList.find(
      (assignment) => assignment.roleId === MATRIX_ROLE.OWNER,
    );

    this.noticeList.push({
      id: `${this.tenantId}:notice_${this.noticeList.length + 1}`,
      ownerUserId: owner?.userId ?? "",
      kind,
      occurredAt: at,
    });
  }
}

const copyRole = (role: CustomRoleRecord): CustomRoleRecord => ({
  id: role.id,
  sourceRoleId: role.sourceRoleId,
  grants: role.grants.map((grant) => ({ ...grant })),
  limits: role.limits.map((limit) => ({ ...limit })),
});

const matrixRole = (
  roleId: MatrixRole,
): { grants: RoleGrantRecord[]; limits: RoleLimitRecord[] } => ({
  grants: permissionCodes.map((permission) => ({
    permission,
    grant: permissionMatrix[permission][roleId],
  })),
  limits: (Object.keys(permissionLimit) as PermissionCode[]).flatMap(
    (permission) => {
      const limit = permissionLimit[permission];

      if (!limit) {
        return [];
      }

      const cap = defaultLimit(limit, roleId);

      return cap === null ? [] : [{ limit, cap }];
    },
  ),
});

const completeRequest = (
  request: AuthorizationRequestRecord,
): AuthorizationRequestRecord => ({
  ...request,
  targetId: request.targetId ?? request.venueId,
  shiftTotals: {
    waiterVoidsBeforeKitchen:
      request.shiftTotals?.waiterVoidsBeforeKitchen ?? 0,
    compShiftCop: request.shiftTotals?.compShiftCop ?? 0,
  },
  consumedAt: request.consumedAt ?? null,
});

const mergeGrants = (
  current: readonly RoleGrantRecord[],
  changes: readonly RoleGrantRecord[],
): RoleGrantRecord[] => {
  const merged = new Map(
    current.map((grant) => [grant.permission, grant.grant]),
  );

  for (const change of changes) {
    merged.set(change.permission, change.grant);
  }

  return permissionCodes.map((permission) => ({
    permission,
    grant: merged.get(permission) ?? GRANT.NO,
  }));
};

const active = (assignment: AssignmentRecord, at: number): boolean =>
  (assignment.validFrom === null || at >= assignment.validFrom) &&
  (assignment.validUntil === null || at < assignment.validUntil);

const covers = (
  assignment: AssignmentRecord,
  target: CoverageTarget,
  at: number,
): boolean => {
  if (!active(assignment, at)) {
    return false;
  }

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
