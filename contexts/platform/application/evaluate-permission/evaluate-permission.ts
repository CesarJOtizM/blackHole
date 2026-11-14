import {
  UnknownAuthorization,
  UnknownSession,
} from "#application/operate-authorization/operate-authorization.js";
import type { AuthorizationClock } from "#application/ports/authorization-clock.js";
import type { AuthorizationRepository } from "#application/ports/authorization-repository.js";
import type { IdentityReader } from "#application/ports/identity-reader.js";
import type {
  SessionReader,
  SessionView,
} from "#application/ports/session-reader.js";
import type { Authorization } from "#domain/authorization.js";
import type { Evaluation, EvaluationTarget } from "#domain/evaluate.js";
import type { PermissionCode } from "#domain/permission-catalog.js";

export interface EvaluatePermissionInput {
  tenantId: string;
  sessionId: string;
  permission: PermissionCode;
  target: EvaluationTarget;
  value: number | null;
  supportGrantId: string | null;
  shiftTotals: { waiterVoidsBeforeKitchen: number };
  selfAuthorizationAttempt?: boolean;
}

const denied = (): Evaluation => ({ outcome: "denied", selfAuthorized: false });

export class EvaluatePermission {
  constructor(
    private readonly authorizations: AuthorizationRepository,
    private readonly sessions: SessionReader,
    private readonly identities: IdentityReader,
    private readonly clock: AuthorizationClock,
  ) {}

  async execute(input: EvaluatePermissionInput): Promise<Evaluation> {
    const session = await this.sessions.find(input.tenantId, input.sessionId);

    if (!session) {
      throw new UnknownSession();
    }

    const person = await this.identities.find(input.tenantId, session.userId);

    if (!person?.active) {
      return denied();
    }

    if (this.foreignPin(session, input.target)) {
      return denied();
    }

    const authorization = await this.authorizations.load(input.tenantId);

    if (!authorization) {
      throw new UnknownAuthorization();
    }

    const at = this.clock.now();

    if (input.supportGrantId !== null) {
      return this.support(authorization, session, input, at);
    }

    return authorization.evaluateFor(session.userId, {
      permission: input.permission,
      at,
      target: input.target,
      value: input.value,
      shiftTotals: input.shiftTotals,
      selfAuthorizationAttempt: input.selfAuthorizationAttempt ?? false,
      shiftId: null,
    });
  }

  private async support(
    authorization: Authorization,
    session: SessionView,
    input: EvaluatePermissionInput,
    at: number,
  ): Promise<Evaluation> {
    const grantId = input.supportGrantId;

    if (grantId === null) {
      return denied();
    }

    const grant = authorization.supportGrant(grantId);

    if (!grant || grant.revoked) {
      return denied();
    }

    const before = authorization.snapshot();
    const expired = authorization.expireSupportGrant(grantId, at);

    if (expired || grant.expired || at >= grant.expiresAt) {
      if (expired) {
        await this.authorizations.save(authorization, {
          before,
          after: authorization.snapshot(),
        });
      }

      return denied();
    }

    authorization.recordSupportAction({
      id: `support_${grantId}_${before.supportActions.length + 1}`,
      grantId,
      actorId: session.userId,
      permission: input.permission,
      occurredAt: at,
    });
    await this.authorizations.save(authorization, {
      before,
      after: authorization.snapshot(),
    });

    return { outcome: "allowed", selfAuthorized: false };
  }

  private foreignPin(session: SessionView, target: EvaluationTarget): boolean {
    return (
      session.kind === "pin" &&
      target.kind === "site" &&
      session.venueId !== target.id
    );
  }
}
