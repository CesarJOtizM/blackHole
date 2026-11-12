import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import type { StationRouteRepository } from "#application/ports/station-route-repository.js";
import { type Check, type LineState, TableNotOpen } from "#domain/check.js";
import { StationRouter } from "#domain/station-router.js";

export interface ChangeLineStateInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
  state: LineState;
}

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: ChangeLineStateInput,
): Promise<Check> => {
  const check = await diningRoom.loadCheck(
    input.tenantId,
    input.venueId,
    input.checkId,
  );

  if (check === null) {
    throw new TableNotOpen();
  }

  return check;
};

const stationFor = async (
  routes: StationRouteRepository,
  check: Check,
  lineId: string,
): Promise<string | undefined> => {
  const line = check.orders
    .flatMap((order) => order.lines)
    .find((item) => item.id === lineId);

  if (line === undefined) {
    return undefined;
  }

  const stored = await routes.load(check.tenantId, check.venueId);
  const route = stored.find((item) => item.productId === line.productId);

  if (route === undefined) {
    return undefined;
  }

  const router = StationRouter.open({ venueId: check.venueId });

  router.assign({
    stationId: route.stationId,
    stationName: route.stationName,
    productId: route.productId,
    output: route.output,
  });

  return router.route({ productId: line.productId }).stationId;
};

export class ChangeLineState {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock,
    private readonly hub: RealtimeHub,
    private readonly routes?: StationRouteRepository,
  ) {}

  async execute(input: ChangeLineStateInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const at = new Date(this.clock.now()).toISOString();
    const stationId =
      input.state === "in_preparation" && this.routes
        ? await stationFor(this.routes, check, input.lineId)
        : undefined;

    check.advance({
      lineId: input.lineId,
      state: input.state,
      at,
      ...(stationId === undefined ? {} : { stationId }),
    });
    await this.diningRoom.saveCheck(check);

    if (input.state !== "ready") {
      return check;
    }

    const notice = check.readyNotices[check.readyNotices.length - 1];

    if (notice === undefined) {
      return check;
    }

    await this.hub.publish({
      kind: "line_ready",
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      tableId: notice.tableId,
      lineId: notice.lineId,
      at: notice.at,
    });

    return check;
  }
}
