import type { AuthorizationClock } from "#application/ports/authorization-clock.js";
import type {
  AuthorizationChanged,
  AuthorizationRepository,
} from "#application/ports/authorization-repository.js";
import type { IdentityReader } from "#application/ports/identity-reader.js";
import type { PinVerifier } from "#application/ports/pin-verifier.js";
import type { SessionReader } from "#application/ports/session-reader.js";
import type { SessionView } from "#application/ports/session-reader.js";
import type { Authorization } from "#domain/authorization.js";
import type { ExceededLimit } from "#domain/evaluate.js";
import type {
  LimitCode,
  PermissionCode,
  ScopeKind,
} from "#domain/permission-catalog.js";

const AUTHORIZATION_COMMAND = {
  COPY_ROLE: "copyRole",
  REVISE_ROLE: "reviseRole",
  ASSIGN: "assign",
  REMOVE_ASSIGNMENT: "removeAssignment",
  SET_VENUE_LIMIT: "setVenueLimit",
  SET_BARTENDER_CHARGE: "setBartenderCharge",
  ENABLE_SHIFT_SELF_AUTHORIZATION: "enableShiftSelfAuthorization",
  REQUEST: "request",
  RESOLVE: "resolve",
  GRANT_SUPPORT: "grantSupport",
  REVOKE_SUPPORT: "revokeSupport",
} as const;

interface CopyRoleCommand {
  type: typeof AUTHORIZATION_COMMAND.COPY_ROLE;
  roleId: string;
  sourceRoleId: string;
}

interface ReviseRoleCommand {
  type: typeof AUTHORIZATION_COMMAND.REVISE_ROLE;
  roleId: string;
  grants: readonly { permission: PermissionCode; grant: "yes" | "with_limit" | "with_authorization" | "no" }[];
}

interface AssignCommand {
  type: typeof AUTHORIZATION_COMMAND.ASSIGN;
  assignmentId: string;
  userId: string;
  roleId: string;
  scopeKind: ScopeKind;
  scopeId: string;
  validFrom: number | null;
  validUntil: number | null;
}

interface RemoveAssignmentCommand {
  type: typeof AUTHORIZATION_COMMAND.REMOVE_ASSIGNMENT;
  assignmentId: string;
}

interface SetVenueLimitCommand {
  type: typeof AUTHORIZATION_COMMAND.SET_VENUE_LIMIT;
  venueId: string;
  roleId: string;
  limit: LimitCode;
  cap: number;
}

interface SetBartenderChargeCommand {
  type: typeof AUTHORIZATION_COMMAND.SET_BARTENDER_CHARGE;
  venueId: string;
  enabled: boolean;
}

interface EnableShiftSelfAuthorizationCommand {
  type: typeof AUTHORIZATION_COMMAND.ENABLE_SHIFT_SELF_AUTHORIZATION;
  id: string;
  venueId: string;
  shiftId: string;
  enabled: boolean;
}

interface RequestCommand {
  type: typeof AUTHORIZATION_COMMAND.REQUEST;
  requestId: string;
  permission: PermissionCode;
  venueId: string;
  value: number | null;
  reason: string;
  expiresAt: number;
}

interface ResolveCommand {
  type: typeof AUTHORIZATION_COMMAND.RESOLVE;
  requestId: string;
  pin: string;
  shiftId: string;
  approved: boolean;
}

interface GrantSupportCommand {
  type: typeof AUTHORIZATION_COMMAND.GRANT_SUPPORT;
  grantId: string;
  actorId: string;
  expiresAt: number;
}

interface RevokeSupportCommand {
  type: typeof AUTHORIZATION_COMMAND.REVOKE_SUPPORT;
  grantId: string;
}

export type AuthorizationCommand =
  | CopyRoleCommand
  | ReviseRoleCommand
  | AssignCommand
  | RemoveAssignmentCommand
  | SetVenueLimitCommand
  | SetBartenderChargeCommand
  | EnableShiftSelfAuthorizationCommand
  | RequestCommand
  | ResolveCommand
  | GrantSupportCommand
  | RevokeSupportCommand;

export interface OperateAuthorizationInput {
  tenantId: string;
  sessionId: string;
  command: AuthorizationCommand;
}

export interface OperateAuthorizationResult extends AuthorizationChanged {
  outcome: "allowed" | "requires_authorization" | "denied" | null;
  exceededLimit: ExceededLimit | null;
}

interface Applied {
  outcome: OperateAuthorizationResult["outcome"];
  exceededLimit: ExceededLimit | null;
}

const assertNever = (command: never): never => {
  throw command;
};

export class UnknownSession extends Error {
  constructor() {
    super("The session is unknown.");
    this.name = "UnknownSession";
  }
}

export class InactiveUser extends Error {
  constructor() {
    super("The user is inactive.");
    this.name = "InactiveUser";
  }
}

export class UnknownAuthorization extends Error {
  constructor() {
    super("The tenant has no authorization.");
    this.name = "UnknownAuthorization";
  }
}

export class ForeignPinSession extends Error {
  constructor() {
    super("A PIN session acts only at its venue.");
    this.name = "ForeignPinSession";
  }
}

export class PermissionDenied extends Error {
  constructor() {
    super("The session cannot perform that command.");
    this.name = "PermissionDenied";
  }
}

export class OperateAuthorization {
  constructor(
    private readonly authorizations: AuthorizationRepository,
    private readonly sessions: SessionReader,
    private readonly identities: IdentityReader,
    private readonly pins: PinVerifier,
    private readonly clock: AuthorizationClock,
  ) {}

  async execute(
    input: OperateAuthorizationInput,
  ): Promise<OperateAuthorizationResult> {
    const session = await this.sessions.find(input.tenantId, input.sessionId);

    if (!session) {
      throw new UnknownSession();
    }

    const person = await this.identities.find(input.tenantId, session.userId);

    if (!person?.active) {
      throw new InactiveUser();
    }

    const authorization = await this.authorizations.load(input.tenantId);

    if (!authorization) {
      throw new UnknownAuthorization();
    }

    this.assertPinVenue(session, authorization, input.command);
    const before = authorization.snapshot();
    const applied = await this.apply(authorization, session, input);
    const event: AuthorizationChanged = {
      before,
      after: authorization.snapshot(),
    };

    await this.authorizations.save(authorization, event);

    return {
      ...event,
      outcome: applied.outcome,
      exceededLimit: applied.exceededLimit,
    };
  }

  private assertPinVenue(
    session: SessionView,
    authorization: Authorization,
    command: AuthorizationCommand,
  ): void {
    if (session.kind !== "pin") {
      return;
    }

    const venueId = commandVenue(authorization, command);

    if (venueId === null || venueId !== session.venueId) {
      throw new ForeignPinSession();
    }
  }

  private async apply(
    authorization: Authorization,
    session: SessionView,
    input: OperateAuthorizationInput,
  ): Promise<Applied> {
    const at = this.clock.now();
    const { command } = input;

    switch (command.type) {
      case AUTHORIZATION_COMMAND.COPY_ROLE:
        this.assertManager(authorization, session.userId, at);
        authorization.copyRole({
          roleId: command.roleId,
          sourceRoleId: command.sourceRoleId,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.REVISE_ROLE:
        this.assertManager(authorization, session.userId, at);
        authorization.reviseRole({
          roleId: command.roleId,
          grants: command.grants,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.ASSIGN:
        this.assertManager(authorization, session.userId, at);
        authorization.assign({
          ...command,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.REMOVE_ASSIGNMENT:
        this.assertManager(authorization, session.userId, at);
        authorization.removeAssignment({
          assignmentId: command.assignmentId,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.SET_VENUE_LIMIT:
        this.assertManager(authorization, session.userId, at);
        authorization.setVenueLimit({
          ...command,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.SET_BARTENDER_CHARGE:
        this.assertManager(authorization, session.userId, at);
        authorization.setBartenderCharge({
          venueId: command.venueId,
          enabled: command.enabled,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.ENABLE_SHIFT_SELF_AUTHORIZATION:
        this.assertManager(authorization, session.userId, at);
        authorization.enableShiftSelfAuthorization({
          ...command,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.REQUEST:
        return this.request(authorization, session, command, at);
      case AUTHORIZATION_COMMAND.RESOLVE:
        return this.resolve(authorization, session, input.tenantId, command, at);
      case AUTHORIZATION_COMMAND.GRANT_SUPPORT:
        this.assertManager(authorization, session.userId, at);
        authorization.grantSupport({
          grantId: command.grantId,
          actorId: command.actorId,
          expiresAt: command.expiresAt,
          actorUserId: session.userId,
          at,
        });
        return unchanged();
      case AUTHORIZATION_COMMAND.REVOKE_SUPPORT:
        this.assertManager(authorization, session.userId, at);
        authorization.revokeSupport(command.grantId);
        return unchanged();
      default:
        return assertNever(command);
    }
  }

  private request(
    authorization: Authorization,
    session: SessionView,
    command: RequestCommand,
    at: number,
  ): Applied {
    const evaluation = authorization.evaluateFor(session.userId, {
      permission: command.permission,
      at,
      target: { kind: "site", id: command.venueId, brandId: null },
      value: command.value,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      selfAuthorizationAttempt: false,
      shiftId: null,
    });

    if (evaluation.outcome !== "requires_authorization") {
      throw new PermissionDenied();
    }

    authorization.requestAuthorization({
      requestId: command.requestId,
      requesterId: session.userId,
      permission: command.permission,
      venueId: command.venueId,
      value: command.value,
      reason: command.reason,
      expiresAt: command.expiresAt,
    });

    return {
      outcome: evaluation.outcome,
      exceededLimit: evaluation.exceededLimit,
    };
  }

  private async resolve(
    authorization: Authorization,
    session: SessionView,
    tenantId: string,
    command: ResolveCommand,
    at: number,
  ): Promise<Applied> {
    const request = authorization
      .snapshot()
      .requests.find((item) => item.id === command.requestId);

    if (!request) {
      throw new PermissionDenied();
    }

    await this.pins.confirm({
      tenantId,
      userId: session.userId,
      pin: command.pin,
      sessionId: session.sessionId,
    });
    authorization.resolveAuthorization({
      requestId: command.requestId,
      authorizerId: session.userId,
      deviceId: session.deviceId,
      shiftId: command.shiftId,
      at,
      approved: command.approved,
      authorizerAssignmentCount: authorization.authorizerCount(
        request.permission,
        request.venueId,
        at,
      ),
    });

    return unchanged();
  }

  private assertManager(
    authorization: Authorization,
    userId: string,
    at: number,
  ): void {
    if (!authorization.canManage(userId, at)) {
      throw new PermissionDenied();
    }
  }
}

const unchanged = (): Applied => ({ outcome: null, exceededLimit: null });

const commandVenue = (
  authorization: Authorization,
  command: AuthorizationCommand,
): string | null => {
  switch (command.type) {
    case AUTHORIZATION_COMMAND.SET_VENUE_LIMIT:
    case AUTHORIZATION_COMMAND.SET_BARTENDER_CHARGE:
    case AUTHORIZATION_COMMAND.ENABLE_SHIFT_SELF_AUTHORIZATION:
    case AUTHORIZATION_COMMAND.REQUEST:
      return command.venueId;
    case AUTHORIZATION_COMMAND.ASSIGN:
      return command.scopeKind === "site" ? command.scopeId : null;
    case AUTHORIZATION_COMMAND.RESOLVE:
      return (
        authorization
          .snapshot()
          .requests.find((request) => request.id === command.requestId)
          ?.venueId ?? null
      );
    case AUTHORIZATION_COMMAND.COPY_ROLE:
    case AUTHORIZATION_COMMAND.REVISE_ROLE:
    case AUTHORIZATION_COMMAND.REMOVE_ASSIGNMENT:
    case AUTHORIZATION_COMMAND.GRANT_SUPPORT:
    case AUTHORIZATION_COMMAND.REVOKE_SUPPORT:
      return null;
    default:
      return assertNever(command);
  }
};
