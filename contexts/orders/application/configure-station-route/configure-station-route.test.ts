import { expect, it, vi } from "vitest";

import {
  ConfigureStationRoute,
  StationOffVenue,
} from "#application/configure-station-route/configure-station-route.js";
import {
  type StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";
import { DuplicateStationProduct } from "#domain/station-router.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const GRILL_ID = "station_grill";
const COLD_ID = "station_cold";
const BAR_ID = "station_bar";
const STEAK_ID = "menu_product_steak";
const RED_THRESHOLD_MINUTES = 15;

class MemoryStationRoutes extends StationRouteRepository {
  private readonly routes: StationRoute[] = [];

  override async load(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StationRoute[]> {
    return this.routes.filter(
      (route) => route.tenantId === tenantId && route.venueId === venueId,
    );
  }

  override async save(route: StationRoute): Promise<void> {
    this.routes.push(route);
  }
}

const grillOnVenue = {
  id: GRILL_ID,
  venueId: VENUE_ID,
  name: "Grill",
};

const savedGrill = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  stationId: GRILL_ID,
  stationName: "Grill",
  productId: STEAK_ID,
  output: "both",
  redThresholdMinutes: RED_THRESHOLD_MINUTES,
};

it("given a venue station, when a product is routed with output and a red threshold, then the route is per venue", async () => {
  const repository = new MemoryStationRoutes();
  const configure = new ConfigureStationRoute(repository);

  const terrace = await configure.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    station: grillOnVenue,
    productId: STEAK_ID,
    output: "both",
    redThresholdMinutes: RED_THRESHOLD_MINUTES,
  });
  const bar = await configure.execute({
    tenantId: TENANT_ID,
    venueId: OTHER_VENUE_ID,
    station: { id: BAR_ID, venueId: OTHER_VENUE_ID, name: "Bar" },
    productId: STEAK_ID,
    output: "printer",
    redThresholdMinutes: RED_THRESHOLD_MINUTES,
  });

  expect(terrace).toEqual(savedGrill);
  expect(bar).toEqual({
    tenantId: TENANT_ID,
    venueId: OTHER_VENUE_ID,
    stationId: BAR_ID,
    stationName: "Bar",
    productId: STEAK_ID,
    output: "printer",
    redThresholdMinutes: RED_THRESHOLD_MINUTES,
  });
  expect(await repository.load(TENANT_ID, VENUE_ID)).toEqual([terrace]);
  expect(await repository.load(TENANT_ID, OTHER_VENUE_ID)).toEqual([bar]);
  expect(await repository.load(OTHER_TENANT_ID, VENUE_ID)).toEqual([]);
});

it("given the product again, when it is routed, then DuplicateStationProduct and nothing is saved", async () => {
  const repository = new MemoryStationRoutes();
  const configure = new ConfigureStationRoute(repository);
  await configure.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    station: grillOnVenue,
    productId: STEAK_ID,
    output: "both",
    redThresholdMinutes: RED_THRESHOLD_MINUTES,
  });
  const save = vi.spyOn(repository, "save");

  const again = configure.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    station: { id: COLD_ID, venueId: VENUE_ID, name: "Cold" },
    productId: STEAK_ID,
    output: "screen",
    redThresholdMinutes: 10,
  });

  await expect(again).rejects.toThrow(DuplicateStationProduct);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.load(TENANT_ID, VENUE_ID)).toEqual([savedGrill]);
});

it("given a station off the venue, when a product is routed, then nothing is saved", async () => {
  const repository = new MemoryStationRoutes();
  const configure = new ConfigureStationRoute(repository);
  const save = vi.spyOn(repository, "save");

  const route = configure.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    station: { id: BAR_ID, venueId: OTHER_VENUE_ID, name: "Bar" },
    productId: STEAK_ID,
    output: "printer",
    redThresholdMinutes: RED_THRESHOLD_MINUTES,
  });

  await expect(route).rejects.toThrow(StationOffVenue);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.load(TENANT_ID, VENUE_ID)).toEqual([]);
  expect(await repository.load(TENANT_ID, OTHER_VENUE_ID)).toEqual([]);
});
