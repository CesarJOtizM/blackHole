import type {
  StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";
import { StationRouter } from "#domain/station-router.js";

export interface VenueStation {
  id: string;
  venueId: string;
  name: string;
}

export interface ConfigureStationRouteInput {
  tenantId: string;
  venueId: string;
  station: VenueStation;
  productId: string;
  output: string;
  redThresholdMinutes: number;
}

export class StationOffVenue extends Error {
  constructor() {
    super("The station does not belong to this venue.");
    this.name = "StationOffVenue";
  }
}

const replay = async (
  routes: StationRouteRepository,
  tenantId: string,
  venueId: string,
): Promise<StationRouter> => {
  const stored = await routes.load(tenantId, venueId);
  const router = StationRouter.open({ venueId });

  for (const route of stored) {
    router.assign({
      stationId: route.stationId,
      stationName: route.stationName,
      productId: route.productId,
      output: route.output,
    });
  }

  return router;
};

export class ConfigureStationRoute {
  constructor(private readonly routes: StationRouteRepository) {}

  async execute(input: ConfigureStationRouteInput): Promise<StationRoute> {
    if (input.station.venueId !== input.venueId) {
      throw new StationOffVenue();
    }

    const router = await replay(this.routes, input.tenantId, input.venueId);

    router.assign({
      stationId: input.station.id,
      stationName: input.station.name,
      productId: input.productId,
      output: input.output,
    });

    const routed = router.route({ productId: input.productId });
    const route: StationRoute = {
      tenantId: input.tenantId,
      venueId: input.venueId,
      stationId: routed.stationId,
      stationName: routed.stationName,
      productId: routed.productId,
      output: routed.output,
      redThresholdMinutes: input.redThresholdMinutes,
    };

    await this.routes.save(route);

    return route;
  }
}
