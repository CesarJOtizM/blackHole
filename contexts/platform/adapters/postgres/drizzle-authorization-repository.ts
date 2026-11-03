import type { PGlite } from "@electric-sql/pglite";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  authorizationAssignments,
  authorizationBartenderFlags,
  authorizationChanges,
  authorizationNotices,
  authorizationRequests,
  authorizationResolutions,
  authorizationRoleLimits,
  authorizationRolePermissions,
  authorizationRoles,
  authorizationShiftFlags,
  authorizationSupportActions,
  authorizationSupportGrants,
  authorizations,
  authorizationVenueLimits,
} from "#adapters/postgres/schema.js";
import type { AuthorizationChanged } from "#application/ports/authorization-repository.js";
import { AuthorizationRepository } from "#application/ports/authorization-repository.js";
import {
  Authorization,
  type AuthorizationSnapshot,
  type CustomRoleRecord,
} from "#domain/authorization.js";
import {
  type Grant,
  type LimitCode,
  type PermissionCode,
  permissionCodes,
  type ScopeKind,
} from "#domain/permission-catalog.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const GRANTS = ["yes", "with_limit", "with_authorization", "no"] as const;
const SCOPES = ["company", "brand", "site", "warehouse", "taxpayer"] as const;
const LIMITS = [
  "discountPercent",
  "voidCop",
  "compShiftCop",
  "varianceCop",
  "cashOutflowCop",
  "wasteCop",
  "countAdjustmentCop",
  "waiterVoidCount",
] as const;
const STATUSES = ["pending", "resolved", "expired"] as const;
const NOTICE_KINDS = ["role", "limit", "self-authorization"] as const;

export class DrizzleAuthorizationRepository extends AuthorizationRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(tenantId: string): Promise<Authorization | null> {
    return this.inTenant(tenantId, async (tx) => {
      const roots = await tx.select().from(authorizations);

      if (roots.length === 0) {
        return null;
      }

      if (roots.length !== 1 || roots[0]?.id !== tenantId) {
        throw new Error("Stored authorization does not match the tenant.");
      }

      const roleRows = await tx
        .select()
        .from(authorizationRoles)
        .orderBy(asc(authorizationRoles.position));
      const permissionRows = await tx
        .select()
        .from(authorizationRolePermissions)
        .orderBy(asc(authorizationRolePermissions.position));
      const limitRows = await tx
        .select()
        .from(authorizationRoleLimits)
        .orderBy(asc(authorizationRoleLimits.position));
      const customRoles: CustomRoleRecord[] = roleRows.map((role) => ({
        id: role.id,
        sourceRoleId: role.sourceRoleId,
        grants: permissionRows
          .filter((permission) => permission.roleId === role.id)
          .map((permission) => ({
            permission: asPermission(permission.permission),
            grant: asGrant(permission.grantValue),
          })),
        limits: limitRows
          .filter((limit) => limit.roleId === role.id)
          .map((limit) => ({
            limit: asLimit(limit.limitCode),
            cap: limit.cap,
          })),
      }));

      return Authorization.restore({
        tenantId,
        customRoles,
        assignments: (
          await tx
            .select()
            .from(authorizationAssignments)
            .orderBy(asc(authorizationAssignments.position))
        ).map((row) => ({
          id: row.id,
          userId: row.userId,
          roleId: row.roleId,
          scopeKind: asScope(row.scopeKind),
          scopeId: row.scopeId,
          validFrom: row.validFrom,
          validUntil: row.validUntil,
        })),
        venueLimits: (
          await tx
            .select()
            .from(authorizationVenueLimits)
            .orderBy(asc(authorizationVenueLimits.position))
        ).map((row) => ({
          venueId: row.venueId,
          roleId: row.roleId,
          limit: asLimit(row.limitCode),
          cap: row.cap,
        })),
        bartenderCharge: (
          await tx
            .select()
            .from(authorizationBartenderFlags)
            .orderBy(asc(authorizationBartenderFlags.position))
        ).map((row) => ({
          venueId: row.venueId,
          enabled: row.enabled,
        })),
        requests: (
          await tx
            .select()
            .from(authorizationRequests)
            .orderBy(asc(authorizationRequests.position))
        ).map((row) => ({
          id: row.id,
          requesterId: row.requesterId,
          permission: asPermission(row.permission),
          venueId: row.venueId,
          targetId: row.targetId,
          value: row.value,
          reason: row.reason,
          expiresAt: row.expiresAt,
          status: asStatus(row.status),
          consumedAt: row.consumedAt,
        })),
        resolutions: (
          await tx
            .select()
            .from(authorizationResolutions)
            .orderBy(asc(authorizationResolutions.position))
        ).map((row) => ({
          id: row.id,
          requestId: row.requestId,
          requesterId: row.requesterId,
          authorizerId: row.authorizerId,
          action: asPermission(row.action),
          value: row.value,
          reason: row.reason,
          deviceId: row.deviceId,
          occurredAt: row.occurredAt,
          selfAuthorized: row.selfAuthorized,
          approved: row.approved,
        })),
        supportGrants: (
          await tx
            .select()
            .from(authorizationSupportGrants)
            .orderBy(asc(authorizationSupportGrants.position))
        ).map((row) => ({
          id: row.id,
          actorId: row.actorId,
          expiresAt: row.expiresAt,
          expired: row.expired,
          revoked: row.revoked,
        })),
        supportActions: (
          await tx
            .select()
            .from(authorizationSupportActions)
            .orderBy(asc(authorizationSupportActions.position))
        ).map((row) => ({
          id: row.id,
          grantId: row.grantId,
          actorId: row.actorId,
          permission: asPermission(row.permission),
          occurredAt: row.occurredAt,
        })),
        shiftFlags: (
          await tx
            .select()
            .from(authorizationShiftFlags)
            .orderBy(asc(authorizationShiftFlags.position))
        ).map((row) => ({
          id: row.id,
          venueId: row.venueId,
          shiftId: row.shiftId,
          selfAuthorization: row.selfAuthorization,
        })),
        notices: (
          await tx
            .select()
            .from(authorizationNotices)
            .orderBy(asc(authorizationNotices.position))
        ).map((row) => ({
          id: row.id,
          ownerUserId: row.ownerUserId,
          kind: asNoticeKind(row.kind),
          occurredAt: row.occurredAt,
        })),
      });
    });
  }

  override async save(
    authorization: Authorization,
    event: AuthorizationChanged,
  ): Promise<void> {
    await this.inTenant(authorization.tenantId, async (tx) => {
      await deleteTree(tx, authorization.tenantId);
      await insertTree(tx, authorization.snapshot());
      await insertEvent(tx, authorization.tenantId, event);
    });
  }

  async eventsFor(tenantId: string): Promise<readonly AuthorizationChanged[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(authorizationChanges)
        .orderBy(asc(authorizationChanges.position));

      return rows.map((row) => ({
        before: row.beforeSnapshot,
        after: row.afterSnapshot,
      }));
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE authorization_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

const deleteTree = async (tx: Transaction, tenantId: string): Promise<void> => {
  await tx
    .delete(authorizationRolePermissions)
    .where(eq(authorizationRolePermissions.tenantId, tenantId));
  await tx
    .delete(authorizationRoleLimits)
    .where(eq(authorizationRoleLimits.tenantId, tenantId));
  await tx
    .delete(authorizationRoles)
    .where(eq(authorizationRoles.tenantId, tenantId));
  await tx
    .delete(authorizationAssignments)
    .where(eq(authorizationAssignments.tenantId, tenantId));
  await tx
    .delete(authorizationVenueLimits)
    .where(eq(authorizationVenueLimits.tenantId, tenantId));
  await tx
    .delete(authorizationBartenderFlags)
    .where(eq(authorizationBartenderFlags.tenantId, tenantId));
  await tx
    .delete(authorizationRequests)
    .where(eq(authorizationRequests.tenantId, tenantId));
  await tx
    .delete(authorizationResolutions)
    .where(eq(authorizationResolutions.tenantId, tenantId));
  await tx
    .delete(authorizationSupportActions)
    .where(eq(authorizationSupportActions.tenantId, tenantId));
  await tx
    .delete(authorizationSupportGrants)
    .where(eq(authorizationSupportGrants.tenantId, tenantId));
  await tx
    .delete(authorizationShiftFlags)
    .where(eq(authorizationShiftFlags.tenantId, tenantId));
  await tx
    .delete(authorizationNotices)
    .where(eq(authorizationNotices.tenantId, tenantId));
  await tx.delete(authorizations).where(eq(authorizations.tenantId, tenantId));
};

const insertTree = async (
  tx: Transaction,
  snapshot: AuthorizationSnapshot,
): Promise<void> => {
  const tenantId = snapshot.tenantId;

  await tx.insert(authorizations).values({ id: tenantId, tenantId });

  if (snapshot.customRoles.length > 0) {
    await tx.insert(authorizationRoles).values(
      snapshot.customRoles.map((role, position) => ({
        id: role.id,
        tenantId,
        sourceRoleId: role.sourceRoleId,
        position,
      })),
    );
    const permissions = snapshot.customRoles.flatMap((role) =>
      role.grants.map((grant) => ({ roleId: role.id, ...grant })),
    );
    if (permissions.length > 0) {
      await tx.insert(authorizationRolePermissions).values(
        permissions.map((permission, position) => ({
          id: `${permission.roleId}:${permission.permission}`,
          tenantId,
          roleId: permission.roleId,
          permission: permission.permission,
          grantValue: permission.grant,
          position,
        })),
      );
    }
    const limits = snapshot.customRoles.flatMap((role) =>
      role.limits.map((limit) => ({ roleId: role.id, ...limit })),
    );
    if (limits.length > 0) {
      await tx.insert(authorizationRoleLimits).values(
        limits.map((limit, position) => ({
          id: `${limit.roleId}:${limit.limit}`,
          tenantId,
          roleId: limit.roleId,
          limitCode: limit.limit,
          cap: limit.cap,
          position,
        })),
      );
    }
  }

  if (snapshot.assignments.length > 0) {
    await tx.insert(authorizationAssignments).values(
      snapshot.assignments.map((assignment, position) => ({
        id: assignment.id,
        tenantId,
        userId: assignment.userId,
        roleId: assignment.roleId,
        scopeKind: assignment.scopeKind,
        scopeId: assignment.scopeId,
        validFrom: assignment.validFrom,
        validUntil: assignment.validUntil,
        position,
      })),
    );
  }

  if (snapshot.venueLimits.length > 0) {
    await tx.insert(authorizationVenueLimits).values(
      snapshot.venueLimits.map((limit, position) => ({
        id: `${limit.venueId}:${limit.roleId}:${limit.limit}`,
        tenantId,
        venueId: limit.venueId,
        roleId: limit.roleId,
        limitCode: limit.limit,
        cap: limit.cap,
        position,
      })),
    );
  }

  if (snapshot.bartenderCharge.length > 0) {
    await tx.insert(authorizationBartenderFlags).values(
      snapshot.bartenderCharge.map((flag, position) => ({
        id: flag.venueId,
        tenantId,
        venueId: flag.venueId,
        enabled: flag.enabled,
        position,
      })),
    );
  }

  if (snapshot.requests.length > 0) {
    await tx.insert(authorizationRequests).values(
      snapshot.requests.map((request, position) => ({
        id: request.id,
        tenantId,
        requesterId: request.requesterId,
        permission: request.permission,
        venueId: request.venueId,
        targetId: request.targetId ?? request.venueId,
        value: request.value,
        reason: request.reason,
        expiresAt: request.expiresAt,
        status: request.status,
        consumedAt: request.consumedAt ?? null,
        position,
      })),
    );
  }

  if (snapshot.resolutions.length > 0) {
    await tx.insert(authorizationResolutions).values(
      snapshot.resolutions.map((resolution, position) => ({
        id: resolution.id,
        tenantId,
        requestId: resolution.requestId,
        requesterId: resolution.requesterId,
        authorizerId: resolution.authorizerId,
        action: resolution.action,
        value: resolution.value,
        reason: resolution.reason,
        deviceId: resolution.deviceId,
        occurredAt: resolution.occurredAt,
        selfAuthorized: resolution.selfAuthorized,
        approved: resolution.approved,
        position,
      })),
    );
  }

  if (snapshot.supportGrants.length > 0) {
    await tx.insert(authorizationSupportGrants).values(
      snapshot.supportGrants.map((grant, position) => ({
        id: grant.id,
        tenantId,
        actorId: grant.actorId,
        expiresAt: grant.expiresAt,
        expired: grant.expired,
        revoked: grant.revoked,
        position,
      })),
    );
  }

  if (snapshot.supportActions.length > 0) {
    await tx.insert(authorizationSupportActions).values(
      snapshot.supportActions.map((action, position) => ({
        id: action.id,
        tenantId,
        grantId: action.grantId,
        actorId: action.actorId,
        permission: action.permission,
        occurredAt: action.occurredAt,
        position,
      })),
    );
  }

  if (snapshot.shiftFlags.length > 0) {
    await tx.insert(authorizationShiftFlags).values(
      snapshot.shiftFlags.map((flag, position) => ({
        id: flag.id,
        tenantId,
        venueId: flag.venueId,
        shiftId: flag.shiftId,
        selfAuthorization: flag.selfAuthorization,
        position,
      })),
    );
  }

  if (snapshot.notices.length > 0) {
    await tx.insert(authorizationNotices).values(
      snapshot.notices.map((notice, position) => ({
        id: notice.id,
        tenantId,
        ownerUserId: notice.ownerUserId,
        kind: notice.kind,
        occurredAt: notice.occurredAt,
        position,
      })),
    );
  }
};

const insertEvent = async (
  tx: Transaction,
  tenantId: string,
  event: AuthorizationChanged,
): Promise<void> => {
  const existing = await tx
    .select({ id: authorizationChanges.id })
    .from(authorizationChanges);

  await tx.insert(authorizationChanges).values({
    id: `${tenantId}:${existing.length}`,
    tenantId,
    position: existing.length,
    beforeSnapshot: event.before,
    afterSnapshot: event.after,
  });
};

const asGrant = (value: string): Grant => {
  const grant = GRANTS.find((item) => item === value);

  if (grant === undefined) {
    throw new Error("Stored grant is not supported.");
  }

  return grant;
};

const asScope = (value: string): ScopeKind => {
  const scope = SCOPES.find((item) => item === value);

  if (scope === undefined) {
    throw new Error("Stored scope is not supported.");
  }

  return scope;
};

const asLimit = (value: string): LimitCode => {
  const limit = LIMITS.find((item) => item === value);

  if (limit === undefined) {
    throw new Error("Stored limit is not supported.");
  }

  return limit;
};

const asPermission = (value: string): PermissionCode => {
  const permission = permissionCodes.find((item) => item === value);

  if (permission === undefined) {
    throw new Error("Stored permission is not supported.");
  }

  return permission;
};

const asStatus = (value: string): "pending" | "resolved" | "expired" => {
  const status = STATUSES.find((item) => item === value);

  if (status === undefined) {
    throw new Error("Stored request status is not supported.");
  }

  return status;
};

const asNoticeKind = (
  value: string,
): "role" | "limit" | "self-authorization" => {
  const kind = NOTICE_KINDS.find((item) => item === value);

  if (kind === undefined) {
    throw new Error("Stored notice kind is not supported.");
  }

  return kind;
};
