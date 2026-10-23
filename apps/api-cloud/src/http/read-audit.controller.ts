import { type AuditReadResult, auditReadResult } from "@blackhole/contracts";
import {
  AuditReadDenied,
  ReadAudit,
} from "@blackhole/platform/application/entry-port";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Query,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "GET audit": "audit.view",
} as const;

const readText = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
};

@Controller()
export class ReadAuditController {
  constructor(
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationClock)
    private readonly clock: AuthorizationClock,
  ) {}

  @Get("audit")
  async read(
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Query("tenantId") tenantQuery: unknown,
    @Query("siteId") siteQuery: unknown,
  ): Promise<AuditReadResult> {
    const sessionId = readText(sessionHeader);
    const tenantId = readText(tenantQuery);

    if (sessionId === null || tenantId === null) {
      throw new BadRequestException();
    }

    const readAudit = new ReadAudit(
      this.audits,
      this.authorizations,
      this.sessions,
      this.clock,
    );

    try {
      return auditReadResult.parse(
        await readAudit.execute({
          tenantId,
          sessionId,
          siteId: readText(siteQuery),
          permission: "audit.view",
        }),
      );
    } catch (error: unknown) {
      if (error instanceof AuditReadDenied) {
        throw new ForbiddenException({ error: error.name });
      }

      throw error;
    }
  }
}
