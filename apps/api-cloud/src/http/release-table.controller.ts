import {
  type DiningTableRecord,
  diningTableRecord,
  markTableReadyCommand,
  releaseTableCommand,
} from "@blackhole/contracts";
import {
  MarkTableReady,
  ReleaseTable,
  TableAlreadyOccupied,
} from "@blackhole/orders/application/entry-port";
import {
  EvaluatePermission,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
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
  "POST dining-tables/:tableId/release": "sale.open-table",
  "POST dining-tables/:tableId/ready": "sale.open-table",
} as const;

const ACTION = routePermissions["POST dining-tables/:tableId/release"];

const DOMAIN_REJECTION = [TableAlreadyOccupied] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ReleaseTableController {
  constructor(
    @Inject(ReleaseTable)
    private readonly releaseTable: ReleaseTable,
    @Inject(MarkTableReady)
    private readonly markTableReady: MarkTableReady,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
  ) {}

  @Post("dining-tables/:tableId/release")
  @HttpCode(HttpStatus.OK)
  async release(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("tableId") tableId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<DiningTableRecord> {
    return this.change(
      tenantId,
      venueId,
      sessionHeader,
      body,
      releaseTableCommand,
      () => this.releaseTable.execute({ tenantId, venueId, tableId }),
    );
  }

  @Post("dining-tables/:tableId/ready")
  @HttpCode(HttpStatus.OK)
  async ready(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("tableId") tableId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<DiningTableRecord> {
    return this.change(
      tenantId,
      venueId,
      sessionHeader,
      body,
      markTableReadyCommand,
      () => this.markTableReady.execute({ tenantId, venueId, tableId }),
    );
  }

  private async change(
    tenantId: string,
    venueId: string,
    sessionHeader: unknown,
    body: unknown,
    commandSchema: { safeParse(value: unknown): { success: boolean } },
    command: () => Promise<{
      id: string;
      tenantId: string;
      venueId: string;
      zone: string;
      state: "free" | "occupied" | "check_requested" | "to_clean";
      diners: number;
    }>,
  ): Promise<DiningTableRecord> {
    const sessionId = readText(sessionHeader);
    const parsed = commandSchema.safeParse(body).success;

    if (sessionId === null || !parsed) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "SaleOpenTableDenied" });
    }

    try {
      const table = await command();

      return diningTableRecord.parse({
        id: table.id,
        tenantId: table.tenantId,
        venueId: table.venueId,
        zone: table.zone,
        state: table.state,
        diners: table.diners,
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
