import {
  type RequestedCheck,
  requestCheckCommand,
  requestedCheck,
} from "@blackhole/contracts";
import {
  RequestCheck,
  TableAlreadyOccupied,
  TableNotOpen,
} from "@blackhole/orders/application/entry-port";
import { Printer } from "@blackhole/orders/application/ports/printer";
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
import {
  orderStayedWaiting,
  queuedOrderCount,
} from "#src/composition/sale-receipt.js";
import { PlatformDiningAudit } from "#src/http/platform-dining-audit.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST checks/:checkId/bill": "sale.open-table",
} as const;

const ACTION = routePermissions["POST checks/:checkId/bill"];

const DOMAIN_REJECTION = [TableAlreadyOccupied, TableNotOpen] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class RequestCheckController {
  constructor(
    @Inject(RequestCheck)
    private readonly requestCheck: RequestCheck,
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
    @Inject(Printer)
    private readonly orders: Printer,
  ) {}

  @Post("checks/:checkId/bill")
  @HttpCode(HttpStatus.OK)
  async bill(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RequestedCheck> {
    const sessionId = readText(sessionHeader);
    const parsed = requestCheckCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "SaleOpenTableDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    try {
      const before = queuedOrderCount(this.orders);
      const billed = await this.requestCheck.execute({
        tenantId,
        venueId,
        checkId,
      });
      const preBillRequestedAt = billed.preBillRequest?.requestedAt;

      await new PlatformDiningAudit(
        new RecordAuditEvent(this.audits, this.digests, this.clock),
      ).record({
        tenantId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        siteId: venueId,
        action: ACTION,
        entity: checkId,
        before: { state: "occupied" },
        after: {
          state: billed.tableState,
          preBillRequestedAt,
        },
        reason: ACTION,
      });

      return requestedCheck.parse({
        id: billed.id,
        tenantId: billed.tenantId,
        venueId: billed.venueId,
        tableId: billed.tableId,
        state: billed.tableState,
        preBillRequestedAt,
        ...(orderStayedWaiting(this.orders, before) ? { printed: false } : {}),
      });
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
