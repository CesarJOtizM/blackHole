import {
  type StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";

const clone = (route: StationRoute): StationRoute => ({ ...route });

const routeKey = (route: StationRoute): string =>
  `${route.tenantId}\u0000${route.venueId}\u0000${route.productId}`;

export class InMemoryStationRouteRepository extends StationRouteRepository {
  private readonly routes = new Map<string, StationRoute>();

  override async load(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StationRoute[]> {
    return [...this.routes.values()]
      .filter(
        (route) => route.tenantId === tenantId && route.venueId === venueId,
      )
      .map(clone);
  }

  override async save(route: StationRoute): Promise<void> {
    this.routes.set(routeKey(route), clone(route));
  }
}
