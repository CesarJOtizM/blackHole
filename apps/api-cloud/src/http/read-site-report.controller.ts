import {
  cashReportResult,
  reportFamily,
  reportPeriodQuery,
  salesReportResult,
  staffReportResult,
  timeReportResult,
} from "@blackhole/contracts";
import {
  EvaluatePermission,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  ReadCashReport,
  ReadSalesReport,
  ReadStaffReport,
  ReadTimeReport,
  type ReportCommand,
} from "@blackhole/reporting/application/entry-port";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "GET reports/:family": "report.view-sales",
} as const;

const readText = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
};

const resultSchema = {
  sales: salesReportResult,
  times: timeReportResult,
  cash: cashReportResult,
  staff: staffReportResult,
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ReadSiteReportController {
  constructor(
    @Inject(ReadSalesReport)
    private readonly sales: ReadSalesReport,
    @Inject(ReadTimeReport)
    private readonly times: ReadTimeReport,
    @Inject(ReadCashReport)
    private readonly cash: ReadCashReport,
    @Inject(ReadStaffReport)
    private readonly staff: ReadStaffReport,
    @Inject(EvaluatePermission)
    private readonly permissions: EvaluatePermission,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Get("reports/:family")
  async read(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("family") familyParam: string,
    @Query("from") from: unknown,
    @Query("to") to: unknown,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<unknown> {
    const family = reportFamily.safeParse(familyParam);
    const period = reportPeriodQuery.safeParse({
      from: readText(from),
      to: readText(to),
    });
    const sessionId = readText(sessionHeader);

    if (!family.success || !period.success || sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.actor(tenantId, sessionId, venueId);
    const command: ReportCommand = {
      tenantId,
      venueId,
      actorId: session.userId,
      role: "site_administrator",
      homeVenueId: session.venueId ?? venueId,
      waiterId: null,
      subjectWaiterId: null,
      shiftId: null,
      from: period.data.from,
      to: period.data.to,
    };

    try {
      const result = await this.dispatch(family.data, command);

      if (result.outcome === "denied") {
        throw new ForbiddenException({ error: result.reason });
      }

      const parsed = resultSchema[family.data].safeParse(result);

      if (!parsed.success) {
        throw new ServiceUnavailableException({ error: "ReportReadFailed" });
      }

      return parsed.data;
    } catch (error: unknown) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException({ error: "ReportReadFailed" });
    }
  }

  private async actor(tenantId: string, sessionId: string, venueId: string) {
    try {
      const decision = await this.permissions.execute({
        tenantId,
        sessionId,
        permission: "report.view-sales",
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      if (decision.outcome !== "allowed") {
        throw new ForbiddenException({ error: "missing_permission" });
      }
    } catch (error: unknown) {
      if (error instanceof UnknownSession) {
        throw new BadRequestException();
      }

      throw error;
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    return session;
  }

  private dispatch(family: keyof typeof resultSchema, command: ReportCommand) {
    if (family === "sales") {
      return this.sales.execute(command);
    }

    if (family === "times") {
      return this.times.execute({
        ...command,
        stationId: null,
        productId: null,
        hour: null,
        weekday: null,
      });
    }

    if (family === "cash") {
      return this.cash.execute(command);
    }

    return this.staff.execute(command);
  }
}
