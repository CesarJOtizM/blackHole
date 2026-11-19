import {
  foodCostReportResult,
  inventoryReportFamily,
  reportPeriodQuery,
  stockGapReportResult,
} from "@blackhole/contracts";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import type { SessionView } from "@blackhole/platform/application/ports/session-reader";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  ReadFoodCostReport,
  ReadStockGapReport,
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
  "GET inventory-reports/:family": "inventory.view-cost",
} as const;

const readText = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
};

const resultSchema = {
  "food-cost": foodCostReportResult,
  "stock-gap": stockGapReportResult,
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ReadInventoryReportController {
  constructor(
    @Inject(ReadFoodCostReport)
    private readonly foodCost: ReadFoodCostReport,
    @Inject(ReadStockGapReport)
    private readonly stockGap: ReadStockGapReport,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Get("inventory-reports/:family")
  async read(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("family") familyParam: string,
    @Query("from") from: unknown,
    @Query("to") to: unknown,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<unknown> {
    const family = inventoryReportFamily.safeParse(familyParam);
    const period = reportPeriodQuery.safeParse({
      from: readText(from),
      to: readText(to),
    });
    const sessionId = readText(sessionHeader);

    if (!family.success || !period.success || sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    const command = await this.command(
      tenantId,
      venueId,
      session,
      period.data.from,
      period.data.to,
    );

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

  private async command(
    tenantId: string,
    venueId: string,
    session: SessionView,
    from: string,
    to: string,
  ): Promise<ReportCommand> {
    const authorization = await this.authorizations.load(tenantId);
    const assignments =
      authorization
        ?.snapshot()
        .assignments.filter(
          (assignment) => assignment.userId === session.userId,
        ) ?? [];
    const site = assignments.find(
      (assignment) => assignment.scopeKind === "site",
    );
    const homeVenueId =
      session.venueId !== null && session.venueId.length > 0
        ? session.venueId
        : (site?.scopeId ?? venueId);

    return {
      tenantId,
      venueId,
      actorId: session.userId,
      role: assignments.some((assignment) => assignment.roleId === "waiter")
        ? "waiter"
        : "site_administrator",
      homeVenueId,
      waiterId: null,
      subjectWaiterId: null,
      shiftId: null,
      from,
      to,
    };
  }

  private dispatch(family: keyof typeof resultSchema, command: ReportCommand) {
    if (family === "food-cost") {
      return this.foodCost.execute(command);
    }

    return this.stockGap.execute(command);
  }
}
