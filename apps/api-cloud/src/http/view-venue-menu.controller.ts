import { type VenueMenu, venueMenu } from "@blackhole/contracts";
import { ViewVenueMenu } from "@blackhole/orders/application/entry-port";
import { Clock as OrdersClock } from "@blackhole/orders/application/ports/clock";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {} as const;

class ReadingClock extends OrdersClock {
  constructor(private readonly source: Clock) {
    super();
  }

  override now(): number {
    return this.source.now();
  }
}

@Controller("tenants/:tenantId")
export class ViewVenueMenuController {
  constructor(
    @Inject(MenuRepository)
    private readonly menus: MenuRepository,
    @Inject(VenueDirectory)
    private readonly venues: VenueDirectory,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Get("venues/:venueId/menu")
  async view(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<VenueMenu> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    if (session.kind === "pin" && session.venueId !== venueId) {
      throw new ForbiddenException({ error: "MenuReadDenied" });
    }

    const view = await new ViewVenueMenu(
      this.menus,
      this.venues,
      new ReadingClock(this.clock),
    ).execute({ tenantId, venueId });

    if (view === null) {
      throw new NotFoundException();
    }

    return venueMenu.parse(view);
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
