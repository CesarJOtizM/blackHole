import {
  InvalidCashAmount,
  InvalidShiftId,
  OpenShift,
  ShiftAlreadyOpen,
  UnknownRegister,
} from "@blackhole/cash-register/application/entry-port";
import {
  type OpenedCashShift,
  openedCashShift,
  openShiftCommand,
} from "@blackhole/contracts";
import {
  EvaluatePermission,
  RecordAuditEvent,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
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

export const routePermissions = {
  "POST cash-registers/:registerId/open": "cash.open-shift",
} as const;

const ACTION = routePermissions["POST cash-registers/:registerId/open"];

const DOMAIN_REJECTION = [
  InvalidCashAmount,
  InvalidShiftId,
  ShiftAlreadyOpen,
  UnknownRegister,
] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class CashShiftController {
  constructor(
    @Inject(OpenShift)
    private readonly openShift: OpenShift,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuditDigest)
    private readonly digests: AuditDigest,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post("cash-registers/:registerId/open")
  @HttpCode(HttpStatus.OK)
  async open(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<OpenedCashShift> {
    const sessionId = readText(sessionHeader);
    const parsed = openShiftCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "CashOpenShiftDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    try {
      const opened = await this.openShift.execute({
        tenantId,
        venueId,
        registerId,
        shiftId: parsed.data.shiftId,
        cashierId: session.userId,
        openingFloatCop: parsed.data.openingFloatCop,
      });
      const recorded = openedCashShift.parse({
        id: opened.id,
        registerId: opened.registerId,
        cashierId: opened.cashierId,
        openingFloatCop: opened.openingFloatCop,
        state: opened.state,
      });

      await new RecordAuditEvent(this.audits, this.digests, this.clock).execute(
        {
          tenantId,
          actorId: session.userId,
          authorizerId: decision.selfAuthorized ? session.userId : null,
          deviceId: session.deviceId,
          siteId: venueId,
          action: ACTION,
          entity: registerId,
          before: null,
          after: {
            id: recorded.id,
            registerId: recorded.registerId,
            cashierId: recorded.cashierId,
            openingFloatCop: recorded.openingFloatCop,
            state: recorded.state,
          },
          reason: ACTION,
        },
      );

      return recorded;
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }

  private async permit(tenantId: string, sessionId: string, venueId: string) {
    const evaluate = new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.authorizationClock,
    );

    try {
      return await evaluate.execute({
        tenantId,
        sessionId,
        permission: ACTION,
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });
    } catch (error: unknown) {
      if (
        error instanceof UnknownSession ||
        error instanceof UnknownAuthorization
      ) {
        throw new ForbiddenException({ error: error.name });
      }

      throw error;
    }
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}
