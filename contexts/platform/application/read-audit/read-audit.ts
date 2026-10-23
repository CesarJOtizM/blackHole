import type {
  AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import type { AuthorizationClock } from "#application/ports/authorization-clock.js";
import type { AuthorizationRepository } from "#application/ports/authorization-repository.js";
import type {
  SessionReader,
  SessionView,
} from "#application/ports/session-reader.js";
import type { Authorization } from "#domain/authorization.js";
import { evaluate } from "#domain/evaluate.js";
import { PERMISSION, type PermissionCode } from "#domain/permission-catalog.js";

export class AuditReadDenied extends Error {
  constructor() {
    super("Audit read is denied.");
    this.name = "AuditReadDenied";
  }
}

export interface AuditReadResult {
  events: readonly AuditEvent[];
  write: false;
}

const SHIFT_TOTALS = { waiterVoidsBeforeKitchen: 0 };

export class ReadAudit {
  constructor(
    private readonly audits: AuditRepository,
    private readonly authorizations: AuthorizationRepository,
    private readonly sessions: SessionReader,
    private readonly clock: AuthorizationClock,
  ) {}

  async execute(input: {
    tenantId: string;
    sessionId: string;
    siteId: string | null;
    permission: PermissionCode;
  }): Promise<AuditReadResult> {
    if (input.permission !== PERMISSION.AUDIT_VIEW) {
      throw new AuditReadDenied();
    }

    const session = await this.sessions.find(input.tenantId, input.sessionId);
    const authorization = await this.authorizations.load(input.tenantId);

    if (!session || !authorization) {
      throw new AuditReadDenied();
    }

    const scope = this.scope(
      authorization,
      session,
      this.clock.now(),
      input.tenantId,
      input.siteId,
    );

    if (scope === "denied") {
      throw new AuditReadDenied();
    }

    const events = await this.audits.list(input.tenantId, null);
    const visible =
      scope === "company"
        ? events
        : events.filter((event) => event.siteId === scope.siteId);

    return { events: visible, write: false };
  }

  private scope(
    authorization: Authorization,
    session: SessionView,
    at: number,
    tenantId: string,
    siteId: string | null,
  ): "company" | { siteId: string } | "denied" {
    const userId = session.userId;
    const snapshot = authorization.snapshot();
    const copiedAuditor = snapshot.customRoles.some(
      (role) => role.id === "auditor",
    );
    const predefinedAuditor =
      !copiedAuditor &&
      snapshot.assignments.some(
        (assignment) =>
          assignment.userId === userId &&
          assignment.roleId === "auditor" &&
          assignment.scopeKind === "company" &&
          (assignment.validFrom === null || at >= assignment.validFrom) &&
          (assignment.validUntil === null || at < assignment.validUntil),
      );

    if (session.kind === "pin") {
      const venueId = session.venueId;

      if (venueId === null || (siteId !== null && siteId !== venueId)) {
        return "denied";
      }

      const venue =
        predefinedAuditor ||
        this.evaluate(authorization, userId, at, {
          kind: "site",
          id: venueId,
          brandId: null,
        });

      return venue ? { siteId: venueId } : "denied";
    }

    if (predefinedAuditor) {
      return "company";
    }

    const company = this.evaluate(authorization, userId, at, {
      kind: "company",
      id: tenantId,
      brandId: null,
    });

    if (company) {
      return "company";
    }

    if (siteId === null) {
      return "denied";
    }

    const site = this.evaluate(authorization, userId, at, {
      kind: "site",
      id: siteId,
      brandId: null,
    });

    if (site) {
      return { siteId };
    }

    return "denied";
  }

  private evaluate(
    authorization: Authorization,
    userId: string,
    at: number,
    target: { kind: "company" | "site"; id: string; brandId: null },
  ): boolean {
    const snapshot = authorization.snapshot();
    const outcome = evaluate({
      permission: PERMISSION.AUDIT_VIEW,
      at,
      target,
      value: null,
      assignments: snapshot.assignments.filter(
        (assignment) => assignment.userId === userId,
      ),
      customRoles: snapshot.customRoles,
      venueLimits: snapshot.venueLimits,
      shiftTotals: SHIFT_TOTALS,
      selfAuthorizationAttempt: false,
      shiftSelfAuthorization: false,
      authorizerAssignmentCount: 0,
      bartenderChargeEnabled: false,
    });

    return outcome.outcome === "allowed";
  }
}
