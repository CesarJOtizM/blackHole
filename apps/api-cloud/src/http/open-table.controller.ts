import {
  type OpenedTable,
  openedTable,
  openTableCommand,
} from "@blackhole/contracts";
import {
  InvalidCheckId,
  OpenTable,
  TableAlreadyOccupied,
} from "@blackhole/orders/application/entry-port";
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

import { PlatformDiningAudit } from "#src/http/platform-dining-audit.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST dining-tables/:tableId/open": "sale.open-table",
} as const;

const ACTION = routePermissions["POST dining-tables/:tableId/open"];

const DOMAIN_REJECTION = [InvalidCheckId, TableAlreadyOccupied] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class OpenTableController {
  constructor(
    @Inject(OpenTable)
    private readonly openTable: OpenTable,
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

  @Post("dining-tables/:tableId/open")
  @HttpCode(HttpStatus.OK)
  async open(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("tableId") tableId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<OpenedTable> {
    const sessionId = readText(sessionHeader);
    const parsed = openTableCommand.safeParse(body);

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
      const opened = await this.openTable.execute({
        tenantId,
        venueId,
        tableId,
        checkId: parsed.data.checkId,
        diners: parsed.data.diners,
      });

      await new PlatformDiningAudit(
        new RecordAuditEvent(this.audits, this.digests, this.clock),
      ).record({
        tenantId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        siteId: venueId,
        action: ACTION,
        entity: tableId,
        before: { state: "free", diners: 0 },
        after: {
          state: opened.table.state,
          diners: opened.table.diners,
          checkId: opened.check.id,
        },
        reason: ACTION,
      });

      return openedTable.parse({
        id: opened.table.id,
        tenantId: opened.table.tenantId,
        venueId: opened.table.venueId,
        zone: opened.table.zone,
        state: opened.table.state,
        diners: opened.table.diners,
        checkId: opened.check.id,
        openedAt: opened.check.openedAt,
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
