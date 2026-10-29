import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import type { StationRouteRepository } from "@blackhole/orders/application/ports/station-route-repository";
import { StationRouter } from "@blackhole/orders/domain";

export class StationRouteDirectory extends StationDirectory {
  constructor(private readonly routes: StationRouteRepository) {
    super();
  }

  override async load(
    tenantId: string,
    venueId: string,
  ): Promise<StationRouter | null> {
    const stored = await this.routes.load(tenantId, venueId);

    if (stored.length === 0) {
      return null;
    }

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
  }
}
