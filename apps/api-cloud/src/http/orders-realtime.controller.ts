import {
  type OrdersRealtimeEvent,
  ordersRealtimeEvent,
} from "@blackhole/contracts";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "@blackhole/orders/application/entry-port";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Headers,
  Inject,
  Injectable,
  type MessageEvent,
  type NestMiddleware,
  Param,
  Sse,
} from "@nestjs/common";
import { Observable } from "rxjs";

const SESSION_HEADER = "x-session-id";

interface SocketLike {
  setKeepAlive?: (enable?: boolean) => unknown;
  setNoDelay?: (noDelay?: boolean) => unknown;
  setTimeout?: (timeout: number) => unknown;
}

interface RealtimeRequest {
  socket?: SocketLike;
  raw?: { socket?: SocketLike };
}

const patchSocket = (socket: SocketLike | undefined): void => {
  if (socket === undefined || typeof socket.setKeepAlive === "function") {
    return;
  }

  const untouched = () => undefined;

  socket.setKeepAlive = untouched;
  socket.setNoDelay = untouched;
  socket.setTimeout = untouched;
};

const patchRealtimeRequest = (request: RealtimeRequest): void => {
  patchSocket(request.socket);
  patchSocket(request.raw?.socket);
};

@Injectable()
export class RealtimeSocketMiddleware implements NestMiddleware {
  use(request: RealtimeRequest, _response: unknown, next: () => void): void {
    patchRealtimeRequest(request);
    next();
  }
}

export const routePermissions = {
  "GET orders-realtime": "session",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class OrdersRealtimeController {
  constructor(
    @Inject(RealtimeHub)
    private readonly hub: RealtimeHub,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Sse("orders-realtime")
  async stream(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<Observable<MessageEvent>> {
    await requireSession(this.sessions, tenantId, sessionHeader);

    return new Observable((subscriber) => {
      const stop = this.hub.subscribe((notice) => {
        if (notice.tenantId !== tenantId || notice.venueId !== venueId) {
          return;
        }

        const data = realtimeEvent(notice);

        if (data === null) {
          return;
        }

        subscriber.next({ type: data.kind, data });
      });

      return () => {
        stop();
      };
    });
  }
}

const realtimeEvent = (notice: RealtimeNotice): OrdersRealtimeEvent | null => {
  const parsed = ordersRealtimeEvent.safeParse(idsOnly(notice));

  return parsed.success ? parsed.data : null;
};

const idsOnly = (notice: RealtimeNotice): unknown => {
  if (notice.kind === "printer_failed") {
    return {
      kind: notice.kind,
      tenantId: notice.tenantId,
      venueId: notice.venueId,
      checkId: notice.checkId,
      tableId: notice.tableId,
      lineId: notice.lineId,
      stationId: notice.stationId,
    };
  }

  if (notice.kind === "line_ready") {
    return {
      kind: notice.kind,
      tenantId: notice.tenantId,
      venueId: notice.venueId,
      checkId: notice.checkId,
      tableId: notice.tableId,
      lineId: notice.lineId,
      at: notice.at,
    };
  }

  return {
    kind: notice.kind,
    tenantId: notice.tenantId,
    venueId: notice.venueId,
    checkId: notice.checkId,
    tableId: notice.tableId,
    lineIds: [...notice.lineIds],
  };
};

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
