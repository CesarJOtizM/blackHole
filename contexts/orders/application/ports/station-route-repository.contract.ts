import { expect, it } from "vitest";

import type {
  StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";

const grillRoute = (tenantId: string, venueId = VENUE_ID): StationRoute => ({
  tenantId,
  venueId,
  stationId: "station_grill",
  stationName: "Grill",
  productId: "menu_steak",
  output: "both",
  redThresholdMinutes: 15,
});

export function stationRouteRepositoryContract(
  createRepository: () =>
    | StationRouteRepository
    | Promise<StationRouteRepository>,
): void {
  it("given a saved route, when it is loaded, then the copy matches", async () => {
    const repository = await createRepository();
    const route = grillRoute(TENANT_A);
    const saved = { ...route };

    await repository.save(route);

    route.redThresholdMinutes = 99;
    const loaded = await repository.load(TENANT_A, VENUE_ID);
    expect(loaded).toEqual([saved]);
    expect(loaded[0]).not.toBe(route);
    expect(await repository.load(TENANT_A, OTHER_VENUE_ID)).toEqual([]);
  });

  it("given tenant B saved a route, when tenant A loads the venue, then B stays hidden", async () => {
    const repository = await createRepository();

    await repository.save(grillRoute(TENANT_A));
    await repository.save(grillRoute(TENANT_B));
    await repository.save(grillRoute(TENANT_A, OTHER_VENUE_ID));

    expect(await repository.load(TENANT_A, VENUE_ID)).toEqual([
      grillRoute(TENANT_A),
    ]);
    expect(await repository.load(TENANT_B, VENUE_ID)).toEqual([
      grillRoute(TENANT_B),
    ]);
    expect(await repository.load(TENANT_A, OTHER_VENUE_ID)).toEqual([
      grillRoute(TENANT_A, OTHER_VENUE_ID),
    ]);
  });
}
