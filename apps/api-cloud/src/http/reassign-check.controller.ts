import {
  type ReassignCheckCommand,
  type ReassignedCheck,
  reassignCheckCommand,
  reassignedCheck,
} from "@blackhole/contracts";
import {
  InvalidLineId,
  InvalidOrderChannel,
  ReassignCheck,
  TableNotOpen,
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
  "POST checks/reassign": "sale.move-items",
} as const;

const ACTION = routePermissions["POST checks/reassign"];

const DOMAIN_REJECTION = [
  InvalidLineId,
  InvalidOrderChannel,
  TableNotOpen,
] as const;

interface SavedCheck {
  id: string;
  tableId: string;
  orders: readonly {
    lines: readonly {
      id: string;
      originTableId: string;
      state: string;
    }[];
  }[];
}

@Controller("tenants/:tenantId/venues/:venueId")
export class ReassignCheckController {
  constructor(
    @Inject(ReassignCheck)
    private readonly reassignCheck: ReassignCheck,
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

  @Post("checks/reassign")
  @HttpCode(HttpStatus.OK)
  async reassign(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ReassignedCheck> {
    const sessionId = readText(sessionHeader);
    const parsed = reassignCheckCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "SaleMoveItemsDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    try {
      const saved = await this.execute(tenantId, venueId, parsed.data);
      const lineIds = saved.orders.flatMap((order) =>
        order.lines.map((line) => line.id),
      );

      await new PlatformDiningAudit(
        new RecordAuditEvent(this.audits, this.digests, this.clock),
      ).record({
        tenantId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        siteId: venueId,
        action: ACTION,
        entity: parsed.data.targetCheckId,
        before: {
          kind: parsed.data.kind,
          targetCheckId: parsed.data.targetCheckId,
          sourceCheckId: parsed.data.sourceCheckId,
        },
        after: {
          kind: parsed.data.kind,
          targetCheckId: saved.id,
          sourceCheckId: parsed.data.sourceCheckId,
          lineIds,
        },
        reason: ACTION,
      });

      return present(saved, parsed.data.sourceCheckId, parsed.data.kind);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }

  private execute(
    tenantId: string,
    venueId: string,
    command: ReassignCheckCommand,
  ) {
    if (command.kind === "join") {
      return this.reassignCheck.execute({
        tenantId,
        venueId,
        kind: "join",
        targetCheckId: command.targetCheckId,
        sourceCheckId: command.sourceCheckId,
      });
    }

    return this.reassignCheck.execute({
      tenantId,
      venueId,
      kind: "transfer",
      targetCheckId: command.targetCheckId,
      sourceCheckId: command.sourceCheckId,
      lineIds: command.lineIds,
    });
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

function present(
  saved: SavedCheck,
  sourceCheckId: string,
  kind: "join" | "transfer",
): ReassignedCheck {
  return reassignedCheck.parse({
    id: saved.id,
    tableId: saved.tableId,
    sourceCheckId,
    kind,
    lines: saved.orders.flatMap((order) =>
      order.lines.map((line) => ({
        id: line.id,
        originTableId: line.originTableId,
        state: line.state,
      })),
    ),
  });
}
