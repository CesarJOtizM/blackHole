import {
  type AuthorizationResult,
  type SaleChargeResult,
  authorizationCommand,
  authorizationResult,
  saleChargeCommand,
  saleChargeResult,
} from "@blackhole/contracts";
import {
  DuplicateAuthorizationId,
  EvaluatePermission,
  ForeignPinSession,
  InactiveUser,
  LastOwnerRemains,
  LimitRaised,
  OperateAuthorization,
  PermissionDenied,
  PinConfirmationLocked,
  PinConfirmationRejected,
  PredefinedRoleRevision,
  PrivilegeEscalation,
  AuthorizerRejected,
  ReasonRequired,
  RequestExpired,
  ScopeRejected,
  SelfAuthorizationDenied,
  UnknownAuthorization,
  UnknownAuthorizationReference,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import type { AuthorizationCommand } from "@blackhole/platform/application/entry-port";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { PinVerifier } from "@blackhole/platform/application/ports/pin-verifier";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";
const SUPPORT_GRANT_HEADER = "x-support-grant-id";

export const routePermissions = {
  "POST authorization": "authorization.manage",
  "POST sales/charges": "sale.charge",
} as const;

const CONFLICT = [
  DuplicateAuthorizationId,
  LastOwnerRemains,
  LimitRaised,
  PredefinedRoleRevision,
  PrivilegeEscalation,
  ReasonRequired,
  RequestExpired,
  ScopeRejected,
  UnknownAuthorizationReference,
] as const;

const DENIED = [
  AuthorizerRejected,
  ForeignPinSession,
  InactiveUser,
  PermissionDenied,
  PinConfirmationLocked,
  PinConfirmationRejected,
  SelfAuthorizationDenied,
  UnknownAuthorization,
  UnknownSession,
] as const;

@Controller("tenants/:tenantId")
export class AuthorizationController {
  constructor(
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(PinVerifier)
    private readonly pins: PinVerifier,
    @Inject(AuthorizationClock)
    private readonly clock: AuthorizationClock,
  ) {}

  @Post("authorization")
  @HttpCode(HttpStatus.OK)
  async operateAuthorization(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<AuthorizationResult> {
    const sessionId = readHeader(sessionHeader);
    const parsed = authorizationCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const operateAuthorization = new OperateAuthorization(
      this.authorizations,
      this.sessions,
      this.identities,
      this.pins,
      this.clock,
    );

    try {
      const result = await operateAuthorization.execute({
        tenantId,
        sessionId,
        command: parsed.data as AuthorizationCommand,
      });

      return authorizationResult.parse(result);
    } catch (error: unknown) {
      throw httpRejection(error);
    }
  }

  @Post("sales/charges")
  @HttpCode(HttpStatus.OK)
  async charge(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Headers(SUPPORT_GRANT_HEADER) supportHeader: unknown,
    @Body() body: unknown,
  ): Promise<SaleChargeResult> {
    const sessionId = readHeader(sessionHeader);
    const parsed = saleChargeCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const evaluatePermission = new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.clock,
    );
    const supportGrantId = readHeader(supportHeader);
    const target = {
      kind: "site" as const,
      id: parsed.data.venueId,
      brandId: null,
    };

    try {
      const chargeEvaluation = await evaluatePermission.execute({
        tenantId,
        sessionId,
        permission: "sale.charge",
        target,
        value: null,
        supportGrantId,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      if (chargeEvaluation.outcome === "denied") {
        throw new PermissionDenied();
      }

      if (parsed.data.discountPercent === null) {
        return saleChargeResult.parse({
          outcome: chargeEvaluation.outcome,
          exceededLimit:
            chargeEvaluation.outcome === "requires_authorization"
              ? chargeEvaluation.exceededLimit
              : null,
        });
      }

      const discount = await evaluatePermission.execute({
        tenantId,
        sessionId,
        permission: "sale.discount",
        target,
        value: parsed.data.discountPercent,
        supportGrantId,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      if (discount.outcome === "denied") {
        throw new PermissionDenied();
      }

      return saleChargeResult.parse({
        outcome: discount.outcome,
        exceededLimit:
          discount.outcome === "requires_authorization"
            ? discount.exceededLimit
            : null,
      });
    } catch (error: unknown) {
      throw httpRejection(error);
    }
  }
}

const readHeader = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

const httpRejection = (error: unknown): Error => {
  for (const Rejection of CONFLICT) {
    if (error instanceof Rejection) {
      return new ConflictException({ error: error.name });
    }
  }

  for (const Rejection of DENIED) {
    if (error instanceof Rejection) {
      return new ForbiddenException({ error: error.name });
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Authorization failed.");
};
