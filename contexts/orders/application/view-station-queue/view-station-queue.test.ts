import { expect, it, vi } from "vitest";

import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  type StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";
import { ViewStationQueue } from "#application/view-station-queue/view-station-queue.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const GRILL_ID = "station_grill";
const COLD_ID = "station_cold";
const SOUP_ID = "menu_product_soup";
const STEAK_ID = "menu_product_steak";
const SALAD_ID = "menu_product_salad";
const OPENED_AT = "2026-10-28T11:50:00.000Z";
const AT_1159 = "2026-10-28T11:59:00.000Z";
const AT_1200 = "2026-10-28T12:00:00.000Z";
const AT_1202 = "2026-10-28T12:02:00.000Z";
const AT_1216 = "2026-10-28T12:16:00.000Z";

class FixedClock extends Clock {
  constructor(private readonly instant: number) {
    super();
  }

  override now(): number {
    return this.instant;
  }
}

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly checks = new Map<string, Check>();

  override async load(
    _tenantId: string,
    _venueId: string,
    _tableId: string,
  ): Promise<DiningTable | null> {
    return null;
  }

  override async save(_table: DiningTable): Promise<void> {}

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }

  override async listChecks(
    tenantId: string,
    venueId: string,
  ): Promise<readonly Check[]> {
    return [...this.checks.values()].filter(
      (check) => check.tenantId === tenantId && check.venueId === venueId,
    );
  }
}

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

const openCheck = (input: {
  tenantId: string;
  venueId?: string;
  checkId: string;
  tableId: string;
}): Check =>
  Check.open({
    id: input.checkId,
    tenantId: input.tenantId,
    venueId: input.venueId ?? VENUE_ID,
    tableId: input.tableId,
    openedAt: OPENED_AT,
  });

const addLine = (
  check: Check,
  input: {
    lineId: string;
    productId: string;
    name: string;
    course: number;
    price: number;
  },
): void => {
  check.addLine({
    orderId: "order_1",
    lineId: input.lineId,
    productId: input.productId,
    name: input.name,
    course: input.course,
    price: input.price,
    channel: "waiter",
  });
};

const routeFor = (input: {
  tenantId?: string;
  venueId?: string;
  stationId: string;
  stationName: string;
  productId: string;
  redThresholdMinutes: number;
}): StationRoute => ({
  tenantId: input.tenantId ?? TENANT_ID,
  venueId: input.venueId ?? VENUE_ID,
  stationId: input.stationId,
  stationName: input.stationName,
  productId: input.productId,
  output: "both",
  redThresholdMinutes: input.redThresholdMinutes,
});

const queueFor = (clock: Clock) => {
  const dining = new MemoryDiningRoom();
  const routes = new MemoryStationRoutes();

  return {
    dining,
    routes,
    view: new ViewStationQueue(dining, routes, clock),
  };
};

it("given lines sent at 12:00 and 12:02, when the station queue is read, then 12:00 is first", async () => {
  const { dining, routes, view } = queueFor(
    new FixedClock(Date.parse(AT_1202)),
  );
  const check = openCheck({
    tenantId: TENANT_ID,
    checkId: "check_5",
    tableId: "table_5",
  });
  addLine(check, {
    lineId: "line_later",
    productId: STEAK_ID,
    name: "Steak",
    course: 2,
    price: 45_000,
  });
  addLine(check, {
    lineId: "line_noon",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
  });
  addLine(check, {
    lineId: "line_cold",
    productId: SALAD_ID,
    name: "Salad",
    course: 3,
    price: 8_000,
  });
  check.send({ course: 2, sentAt: AT_1202 });
  check.send({ course: 1, sentAt: AT_1200 });
  check.send({ course: 3, sentAt: AT_1159 });
  await dining.saveCheck(check);
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: STEAK_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: SOUP_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      stationId: COLD_ID,
      stationName: "Cold",
      productId: SALAD_ID,
      redThresholdMinutes: 15,
    }),
  );
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");
  const saveRoute = vi.spyOn(routes, "save");

  const queue = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
  });

  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
  expect(saveRoute).not.toHaveBeenCalled();
  expect(queue.lines.map((line) => line.sentAt)).toEqual([AT_1200, AT_1202]);
  expect(queue.lines.map((line) => line.lineId)).toEqual([
    "line_noon",
    "line_later",
  ]);
});

it("given a 15-minute threshold and a 16-minute wait, when the station queue is read, then the line is red", async () => {
  const { dining, routes, view } = queueFor(
    new FixedClock(Date.parse(AT_1216)),
  );
  const check = openCheck({
    tenantId: TENANT_ID,
    checkId: "check_5",
    tableId: "table_5",
  });
  addLine(check, {
    lineId: "line_soup",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
  });
  addLine(check, {
    lineId: "line_steak",
    productId: STEAK_ID,
    name: "Steak",
    course: 1,
    price: 45_000,
  });
  check.send({ course: 1, sentAt: AT_1200 });
  await dining.saveCheck(check);
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: SOUP_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: STEAK_ID,
      redThresholdMinutes: 30,
    }),
  );

  const queue = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
  });

  expect(queue.lines).toHaveLength(2);
  expect(queue.lines.find((line) => line.lineId === "line_soup")).toMatchObject(
    { sentAt: AT_1200, color: "red" },
  );
  expect(
    queue.lines.find((line) => line.lineId === "line_steak"),
  ).toMatchObject({ sentAt: AT_1200, color: "green" });
});

it("given held lines, when the station queue is read, then they are off the queue", async () => {
  const { dining, routes, view } = queueFor(
    new FixedClock(Date.parse(AT_1200)),
  );
  const check = openCheck({
    tenantId: TENANT_ID,
    checkId: "check_5",
    tableId: "table_5",
  });
  addLine(check, {
    lineId: "line_soup",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
  });
  addLine(check, {
    lineId: "line_steak",
    productId: STEAK_ID,
    name: "Steak",
    course: 2,
    price: 45_000,
  });
  check.send({ course: 1, sentAt: AT_1200 });
  await dining.saveCheck(check);
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: SOUP_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: STEAK_ID,
      redThresholdMinutes: 15,
    }),
  );

  const queue = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
  });

  expect(queue.lines.map((line) => line.lineId)).toEqual(["line_soup"]);
  expect(check.total).toBe(12_000);
});

it("given another tenant, when the station queue is read, then that tenant stays hidden", async () => {
  const { dining, routes, view } = queueFor(
    new FixedClock(Date.parse(AT_1202)),
  );
  const ours = openCheck({
    tenantId: TENANT_ID,
    checkId: "check_5",
    tableId: "table_5",
  });
  addLine(ours, {
    lineId: "line_soup",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
  });
  ours.send({ course: 1, sentAt: AT_1200 });
  const theirs = openCheck({
    tenantId: OTHER_TENANT_ID,
    checkId: "check_5",
    tableId: "table_8",
  });
  addLine(theirs, {
    lineId: "line_steak",
    productId: STEAK_ID,
    name: "Steak",
    course: 1,
    price: 45_000,
  });
  theirs.send({ course: 1, sentAt: AT_1159 });
  const otherVenue = openCheck({
    tenantId: TENANT_ID,
    venueId: OTHER_VENUE_ID,
    checkId: "check_9",
    tableId: "table_9",
  });
  addLine(otherVenue, {
    lineId: "line_salad",
    productId: SALAD_ID,
    name: "Salad",
    course: 1,
    price: 8_000,
  });
  otherVenue.send({ course: 1, sentAt: AT_1159 });
  await dining.saveCheck(ours);
  await dining.saveCheck(theirs);
  await dining.saveCheck(otherVenue);
  await routes.save(
    routeFor({
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: SOUP_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      tenantId: OTHER_TENANT_ID,
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: STEAK_ID,
      redThresholdMinutes: 15,
    }),
  );
  await routes.save(
    routeFor({
      venueId: OTHER_VENUE_ID,
      stationId: GRILL_ID,
      stationName: "Grill",
      productId: SALAD_ID,
      redThresholdMinutes: 15,
    }),
  );
  const listChecks = vi.spyOn(dining, "listChecks");
  const loadRoutes = vi.spyOn(routes, "load");

  const queue = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
  });

  expect(listChecks).toHaveBeenCalledWith(TENANT_ID, VENUE_ID);
  expect(loadRoutes).toHaveBeenCalledWith(TENANT_ID, VENUE_ID);
  expect(queue.lines.map((line) => line.lineId)).toEqual(["line_soup"]);
});
