import {
  type ConfiguredStationRoute,
  configuredStationRoute,
  configureStationRouteCommand,
} from "@blackhole/contracts";
import {
  ConfigureStationRoute,
  DuplicateStationProduct,
  InvalidMenuId,
  InvalidStationId,
  InvalidStationOutput,
  StationOffVenue,
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
  "POST station-routes": "organization.structure",
} as const;

const ACTION = routePermissions["POST station-routes"];

const DOMAIN_REJECTION = [
  DuplicateStationProduct,
  InvalidMenuId,
  InvalidStationId,
  InvalidStationOutput,
  StationOffVenue,
] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ConfigureStationRouteController {
  constructor(
    @Inject(ConfigureStationRoute)
    private readonly configureStationRoute: ConfigureStationRoute,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
  ) {}

  @Post("station-routes")
  @HttpCode(HttpStatus.OK)
  async configure(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ConfiguredStationRoute> {
    const sessionId = readText(sessionHeader);
    const parsed = configureStationRouteCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "OrganizationStructureDenied" });
    }

    try {
      const route = await this.configureStationRoute.execute({
        tenantId,
        venueId,
        station: parsed.data.station,
        productId: parsed.data.productId,
        output: parsed.data.output,
        redThresholdMinutes: parsed.data.redThresholdMinutes,
      });

      return configuredStationRoute.parse(route);
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
