import {
  ChangeExceedsCash,
  ChargeCheck,
  type ChargeCheckResult,
  IncompleteCard,
  InvalidCashAmount,
  InvalidClosureId,
  InvalidPaymentId,
  MissingTip,
  UnknownAccount,
  UnknownRegister,
} from "@blackhole/cash-register/application/entry-port";
import {
  type ChargedCheck,
  chargeCheckCommand,
  chargedCheck,
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
import { OrdersAccount } from "#src/composition/orders-account.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST cash-registers/:registerId/checks/:checkId/charge": "sale.charge",
} as const;

const ACTION =
  routePermissions["POST cash-registers/:registerId/checks/:checkId/charge"];

const DOMAIN_REJECTION = [
  ChangeExceedsCash,
  IncompleteCard,
  InvalidCashAmount,
  InvalidClosureId,
  InvalidPaymentId,
  MissingTip,
  UnknownAccount,
  UnknownRegister,
] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ChargeCheckController {
  constructor(
    @Inject(ChargeCheck)
    private readonly chargeCheck: ChargeCheck,
    @Inject(OrdersAccount)
    private readonly accounts: OrdersAccount,
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

  @Post("cash-registers/:registerId/checks/:checkId/charge")
  @HttpCode(HttpStatus.OK)
  async charge(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ChargedCheck> {
    const sessionId = readText(sessionHeader);
    const parsed = chargeCheckCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "SaleChargeDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    const paidMarks = this.accounts.markCount();

    try {
      const charged = await this.chargeCheck.execute({
        tenantId,
        venueId,
        registerId,
        checkId,
        commandId: parsed.data.commandId,
        paymentId: parsed.data.paymentId,
        closureId: parsed.data.closureId,
        tenders: parsed.data.tenders,
        tip: parsed.data.tip,
      });
      const recorded = presentCharge(charged);

      if (this.accounts.markCount() === paidMarks) {
        return recorded;
      }

      await new RecordAuditEvent(this.audits, this.digests, this.clock).execute(
        {
          tenantId,
          actorId: session.userId,
          authorizerId: decision.selfAuthorized ? session.userId : null,
          deviceId: session.deviceId,
          siteId: venueId,
          action: ACTION,
          entity: checkId,
          before: null,
          after: recorded,
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

function presentCharge(result: ChargeCheckResult): ChargedCheck {
  return chargedCheck.parse({
    id: result.closure.id,
    status: result.closure.status,
    commandId: result.closure.commandId,
    checkId: result.closure.checkId,
    tableId: result.closure.tableId,
    registerId: result.closure.registerId,
    paymentId: result.closure.paymentId,
    saleCop: result.closure.saleCop,
    changeCop: result.closure.changeCop,
    lines: result.closure.lines.map((line) => ({
      lineId: line.lineId,
      productId: line.productId,
      priceCop: line.priceCop,
      originTableId: line.originTableId,
      menuClass: line.menuClass,
    })),
    tenders: result.closure.tenders.map((tender) => ({ ...tender })),
    tip: { ...result.closure.tip },
  });
}
