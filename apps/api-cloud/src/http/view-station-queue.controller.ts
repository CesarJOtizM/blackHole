import { type StationQueue, stationQueue } from "@blackhole/contracts";
import { ViewStationQueue } from "@blackhole/orders/application/entry-port";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "GET stations/:stationId/queue": "session",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ViewStationQueueController {
  constructor(
    @Inject(ViewStationQueue)
    private readonly viewStationQueue: ViewStationQueue,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Get("stations/:stationId/queue")
  async view(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("stationId") stationId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<StationQueue> {
    await requireSession(this.sessions, tenantId, sessionHeader);

    return stationQueue.parse(
      await this.viewStationQueue.execute({ tenantId, venueId, stationId }),
    );
  }
}

async function requireSession(
  sessions: SessionReader,
  tenantId: string,
  sessionHeader: unknown,
): Promise<void> {
  const sessionId = readText(sessionHeader);

  if (sessionId === null) {
    throw new BadRequestException();
  }

  const session = await sessions.find(tenantId, sessionId);

  if (!session) {
    throw new ForbiddenException({ error: "UnknownSession" });
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
