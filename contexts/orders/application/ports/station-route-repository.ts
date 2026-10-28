import type { StationOutput } from "#domain/station-router.js";

export interface StationRoute {
  tenantId: string;
  venueId: string;
  stationId: string;
  stationName: string;
  productId: string;
  output: StationOutput;
  redThresholdMinutes: number;
}

export abstract class StationRouteRepository {
  abstract load(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StationRoute[]>;

  abstract save(route: StationRoute): Promise<void>;
}
