import { type TableMap, tableMap } from "@blackhole/contracts";
import { ViewTableMap } from "@blackhole/orders/application/entry-port";
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
  "GET table-map": "session",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ViewTableMapController {
  constructor(
    @Inject(ViewTableMap)
    private readonly viewTableMap: ViewTableMap,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Get("table-map")
  async view(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<TableMap> {
    await requireSession(this.sessions, tenantId, sessionHeader);

    return tableMap.parse(
      await this.viewTableMap.execute({ tenantId, venueId }),
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
