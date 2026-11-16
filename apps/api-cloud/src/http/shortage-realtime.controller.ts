import { type ShortageNotice, shortageNotice } from "@blackhole/contracts";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Headers,
  Inject,
  type MessageEvent,
  Param,
  Sse,
} from "@nestjs/common";
import { Observable } from "rxjs";

const SESSION_HEADER = "x-session-id";
const WAITER_ROLE = "waiter";

export const routePermissions = {
  "GET shortage-realtime": "session",
} as const;

export abstract class ShortageNoticeFeed {
  abstract list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ShortageNotice[]>;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class ShortageRealtimeController {
  constructor(
    @Inject(ShortageNoticeFeed)
    private readonly notices: ShortageNoticeFeed,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Sse("shortage-realtime")
  async stream(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<Observable<MessageEvent>> {
    await this.permit(tenantId, sessionHeader);
    const stored = await this.notices.list(tenantId, venueId);
    const events = stored.flatMap((notice) => {
      const parsed = shortageNotice.safeParse(notice);

      if (!parsed.success || parsed.data.venueId !== venueId) {
        return [];
      }

      return [parsed.data];
    });

    return new Observable((subscriber) => {
      for (const notice of events) {
        subscriber.next({ type: notice.kind, data: notice });
      }
    });
  }

  private async permit(
    tenantId: string,
    sessionHeader: unknown,
  ): Promise<void> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    const authorization = await this.authorizations.load(tenantId);
    const roles =
      authorization
        ?.snapshot()
        .assignments.filter((assignment) => assignment.userId === session.userId)
        .map((assignment) => assignment.roleId) ?? [];

    if (roles.length === 0 || roles.every((role) => role === WAITER_ROLE)) {
      throw new ForbiddenException({ error: "ShortageNoticeDenied" });
    }
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
