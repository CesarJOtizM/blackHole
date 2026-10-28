import { expect, it } from "vitest";

import { ComboNotSent } from "#domain/check.js";
import { InvalidMenuId } from "#domain/menu.js";
import {
  DuplicateStationProduct,
  InvalidStationId,
  InvalidStationOutput,
  MissingStation,
  StationRouter,
} from "#domain/station-router.js";

const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const GRILL_ID = "station_grill";
const COLD_ID = "station_cold";
const BAR_ID = "station_bar";
const STEAK_ID = "menu_product_steak";
const SALAD_ID = "menu_product_salad";
const SODA_ID = "menu_product_soda";
const LUNCH_ID = "menu_combo_lunch";

const openVenueRouter = (venueId = VENUE_ID) => StationRouter.open({ venueId });

it("given Grill output both, when Steak is routed, then screen and printer are selected", () => {
  const router = openVenueRouter();
  router.assign({
    stationId: GRILL_ID,
    stationName: "Grill",
    productId: STEAK_ID,
    output: "both",
  });

  const route = router.route({ productId: STEAK_ID });

  expect(route).toEqual({
    stationId: GRILL_ID,
    stationName: "Grill",
    productId: STEAK_ID,
    output: "both",
    screen: true,
    printer: true,
    register: true,
  });
});

it("given Cold output screen, when Salad is routed, then only the screen is selected", () => {
  const router = openVenueRouter();
  router.assign({
    stationId: COLD_ID,
    stationName: "Cold",
    productId: SALAD_ID,
    output: "screen",
  });

  const route = router.route({ productId: SALAD_ID });

  expect(route.output).toBe("screen");
  expect(route.screen).toBe(true);
  expect(route.printer).toBe(false);
  expect(route.register).toBe(true);
});

it("given Bar output printer, when Soda is routed, then only the printer is selected", () => {
  const router = openVenueRouter();
  router.assign({
    stationId: BAR_ID,
    stationName: "Bar",
    productId: SODA_ID,
    output: "printer",
  });

  const route = router.route({ productId: SODA_ID });

  expect(route.output).toBe("printer");
  expect(route.screen).toBe(false);
  expect(route.printer).toBe(true);
  expect(route.register).toBe(true);
});

it("given no station, when Steak is routed, then MissingStation", () => {
  const router = openVenueRouter();

  const route = () => {
    router.route({ productId: STEAK_ID });
  };

  expect(route).toThrow(MissingStation);
});

it("given Steak on Grill, when a second station is assigned, then DuplicateStationProduct", () => {
  const router = openVenueRouter();
  router.assign({
    stationId: GRILL_ID,
    stationName: "Grill",
    productId: STEAK_ID,
    output: "both",
  });

  const assignAgain = () => {
    router.assign({
      stationId: COLD_ID,
      stationName: "Cold",
      productId: STEAK_ID,
      output: "screen",
    });
  };

  expect(assignAgain).toThrow(DuplicateStationProduct);
  expect(router.route({ productId: STEAK_ID })).toMatchObject({
    stationName: "Grill",
    screen: true,
    printer: true,
  });
});

it("given a combo, when it is assigned to Grill, then ComboNotSent", () => {
  const router = openVenueRouter();

  const assign = () => {
    router.assign({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: LUNCH_ID,
      output: "both",
      kind: "combo",
    });
  };

  expect(assign).toThrow(ComboNotSent);
  expect(() => router.route({ productId: LUNCH_ID })).toThrow(MissingStation);
});

it("given a combo, when it is routed, then ComboNotSent", () => {
  const router = openVenueRouter();
  router.assign({
    stationId: GRILL_ID,
    stationName: "Grill",
    productId: STEAK_ID,
    output: "both",
  });

  const route = () => {
    router.route({ productId: LUNCH_ID, kind: "combo" });
  };

  expect(route).toThrow(ComboNotSent);
  expect(router.route({ productId: STEAK_ID }).stationName).toBe("Grill");
});

it("given two venues, when each assigns Steak, then each station stays", () => {
  const terrace = openVenueRouter();
  const bar = openVenueRouter(OTHER_VENUE_ID);
  terrace.assign({
    stationId: GRILL_ID,
    stationName: "Grill",
    productId: STEAK_ID,
    output: "both",
  });
  bar.assign({
    stationId: BAR_ID,
    stationName: "Bar",
    productId: STEAK_ID,
    output: "printer",
  });

  expect(terrace.route({ productId: STEAK_ID }).stationName).toBe("Grill");
  expect(bar.route({ productId: STEAK_ID }).stationName).toBe("Bar");
});

it("given an identifier without the station_ prefix, when a product is assigned, then it is rejected", () => {
  const router = openVenueRouter();

  const assign = () => {
    router.assign({
      stationId: "grill",
      stationName: "Grill",
      productId: STEAK_ID,
      output: "both",
    });
  };

  expect(assign).toThrow(InvalidStationId);
});

it("given a product identifier without the menu_ prefix, when it is assigned, then it is rejected", () => {
  const router = openVenueRouter();

  const assign = () => {
    router.assign({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: "steak",
      output: "both",
    });
  };

  expect(assign).toThrow(InvalidMenuId);
});

it("given an unknown output, when a product is assigned, then it is rejected", () => {
  const router = openVenueRouter();

  const assign = () => {
    router.assign({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: STEAK_ID,
      output: "drawer",
    });
  };

  expect(assign).toThrow(InvalidStationOutput);
  expect(() => router.route({ productId: STEAK_ID })).toThrow(MissingStation);
});
