import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type {
  StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";
import type { Check, LineState, OrderChannel } from "#domain/check.js";

const MINUTE_MS = 60_000;

export type StationQueueColor = "red" | "green";

export interface ViewStationQueueInput {
  tenantId: string;
  venueId: string;
  stationId: string;
}

export interface StationQueueLine {
  checkId: string;
  tableId: string;
  lineId: string;
  productId: string;
  name: string;
  sentAt: string;
  state: LineState;
  channel: OrderChannel;
  color: StationQueueColor;
}

export interface StationQueue {
  stationId: string;
  lines: readonly StationQueueLine[];
}

type ListedLine = Check["orders"][number]["lines"][number];

const stillWaiting = (state: LineState): boolean =>
  state === "sent" || state === "in_preparation";

const colorFor = (
  state: LineState,
  sentAt: string,
  redThresholdMinutes: number,
  now: number,
): StationQueueColor => {
  const waitedMs = now - Date.parse(sentAt);

  if (stillWaiting(state) && waitedMs >= redThresholdMinutes * MINUTE_MS) {
    return "red";
  }

  return "green";
};

const onStation = (
  route: StationRoute,
  input: ViewStationQueueInput,
): boolean =>
  route.tenantId === input.tenantId &&
  route.venueId === input.venueId &&
  route.stationId === input.stationId;

const queueLine = (
  check: Check,
  line: ListedLine,
  channel: OrderChannel,
  routes: ReadonlyMap<string, StationRoute>,
  now: number,
): StationQueueLine | null => {
  if (line.state === "held" || line.sentAt === undefined) {
    return null;
  }

  const route = routes.get(line.productId);

  if (route === undefined) {
    return null;
  }

  return {
    checkId: check.id,
    tableId: check.tableId,
    lineId: line.id,
    productId: line.productId,
    name: line.name,
    sentAt: line.sentAt,
    state: line.state,
    channel,
    color: colorFor(line.state, line.sentAt, route.redThresholdMinutes, now),
  };
};

const bySentAt = (left: StationQueueLine, right: StationQueueLine): number => {
  const byTime = left.sentAt.localeCompare(right.sentAt);

  if (byTime !== 0) {
    return byTime;
  }

  return left.lineId.localeCompare(right.lineId);
};

export class ViewStationQueue {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly routes: StationRouteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ViewStationQueueInput): Promise<StationQueue> {
    const listed = await this.diningRoom.listChecks(
      input.tenantId,
      input.venueId,
    );
    const stored = await this.routes.load(input.tenantId, input.venueId);
    const routes = new Map<string, StationRoute>();

    for (const route of stored) {
      if (!onStation(route, input)) {
        continue;
      }

      routes.set(route.productId, route);
    }

    const now = this.clock.now();
    const lines: StationQueueLine[] = [];

    for (const check of listed) {
      if (
        check.tenantId !== input.tenantId ||
        check.venueId !== input.venueId
      ) {
        continue;
      }

      for (const order of check.orders) {
        for (const line of order.lines) {
          const queued = queueLine(check, line, order.channel, routes, now);

          if (queued !== null) {
            lines.push(queued);
          }
        }
      }
    }

    lines.sort(bySentAt);

    return { stationId: input.stationId, lines };
  }
}
