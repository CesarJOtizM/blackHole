import {
  type ControlReport,
  ReadControlReport,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "GET control-report": "audit.view",
} as const;

const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

@Controller("tenants/:tenantId/venues/:venueId")
export class ReadControlReportController {
  constructor(
    @Inject(ReadControlReport)
    private readonly reports: ReadControlReport,
  ) {}

  @Get("control-report")
  async read(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<ControlReport> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    try {
      return await this.reports.execute({
        tenantId,
        sessionId,
        siteId: venueId,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownSession) {
        throw new BadRequestException();
      }

      throw error;
    }
  }
}
