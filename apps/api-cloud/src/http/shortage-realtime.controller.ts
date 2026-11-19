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
  Optional,
  Param,
  Sse,
} from "@nestjs/common";
import { Observable } from "rxjs";

import { negativeStockScreenNotices } from "#src/composition/sale-consumption.js";
import { ShortageNoticeHub } from "#src/http/shortage-notice-hub.js";

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
    @Optional()
    @Inject(ShortageNoticeHub)
    private readonly hub?: ShortageNoticeHub,
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
    const seen = new Set(
      events.map((notice) => `${notice.alertId}\u0000${notice.role}`),
    );

    for (const notice of negativeStockScreenNotices(tenantId, venueId)) {
      const parsed = shortageNotice.safeParse(notice);
      const key = `${notice.alertId}\u0000${notice.role}`;

      if (!parsed.success || parsed.data.venueId !== venueId || seen.has(key)) {
        continue;
      }

      seen.add(key);
      events.push(parsed.data);
    }

    return new Observable((subscriber) => {
      for (const notice of events) {
        subscriber.next({ type: notice.kind, data: notice });
      }

      if (!this.hub) {
        return;
      }

      return this.hub.subscribe((notice) => {
        const parsed = shortageNotice.safeParse(notice);
        const key = `${notice.alertId}\u0000${notice.role}`;

        if (
          !parsed.success ||
          parsed.data.venueId !== venueId ||
          seen.has(key)
        ) {
          return;
        }

        seen.add(key);
        subscriber.next({ type: parsed.data.kind, data: parsed.data });
      });
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
        .assignments.filter(
          (assignment) => assignment.userId === session.userId,
        )
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
