import { type CheckAccount, checkAccount } from "@blackhole/contracts";
import { GetCheck } from "@blackhole/orders/application/entry-port";
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

export const routePermissions = {
  "GET checks/:checkId": "session",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class GetCheckController {
  constructor(
    @Inject(GetCheck)
    private readonly getCheck: GetCheck,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Get("checks/:checkId")
  async view(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<CheckAccount> {
    await requireSession(this.sessions, tenantId, sessionHeader);
    const account = await this.getCheck.execute({
      tenantId,
      venueId,
      checkId,
    });

    if (account === null) {
      throw new NotFoundException();
    }

    return checkAccount.parse(account);
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
