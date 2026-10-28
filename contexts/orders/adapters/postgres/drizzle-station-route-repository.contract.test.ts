import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleStationRouteRepository } from "#adapters/postgres/drizzle-station-route-repository.js";
import { stationRouteRepositoryContract } from "#application/ports/station-route-repository.contract.js";
import type { StationRoute } from "#application/ports/station-route-repository.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";

const menuMigration = readFileSync(
  fileURLToPath(new URL("./0001_menu.sql", import.meta.url)),
  "utf8",
);
const diningMigration = readFileSync(
  fileURLToPath(new URL("./0002_dining_room.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const applyMigrations = async (client: PGlite): Promise<void> => {
  await client.exec(menuMigration);
  await client.exec(diningMigration);
};

const openClient = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await applyMigrations(client);

  return client;
};

const grillRoute = (tenantId: string): StationRoute => ({
  tenantId,
  venueId: VENUE_ID,
  stationId: "station_grill",
  stationName: "Grill",
  productId: "menu_steak",
  output: "both",
  redThresholdMinutes: 15,
});

stationRouteRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await applyMigrations(client);

  return new DrizzleStationRouteRepository(client);
});

it("given station routes for tenants A and B, when orders_app selects them without a tenant filter, then only tenant A returns", async () => {
  const client = await openClient();

  await client.exec(`
    INSERT INTO station_routes (
      id, tenant_id, venue_id, name, output, red_threshold_minutes
    )
    VALUES
      (
        'station_grill',
        'organization_tenant_a',
        'organization_venue_1',
        'Grill',
        'both',
        15
      ),
      (
        'station_bar',
        'organization_tenant_b',
        'organization_venue_1',
        'Bar',
        'printer',
        10
      );

    INSERT INTO station_route_products (
      tenant_id, venue_id, station_id, product_id
    )
    VALUES
      (
        'organization_tenant_a',
        'organization_venue_1',
        'station_grill',
        'menu_steak'
      ),
      (
        'organization_tenant_b',
        'organization_venue_1',
        'station_bar',
        'menu_steak'
      )
  `);
  await client.exec("SET ROLE orders_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const routes = await client.query<{ id: string }>(
    "SELECT id FROM station_routes",
  );
  const products = await client.query<{ product_id: string }>(
    "SELECT product_id FROM station_route_products",
  );

  expect(routes.rows.map((row) => row.id)).toEqual(["station_grill"]);
  expect(products.rows.map((row) => row.product_id)).toEqual(["menu_steak"]);
});

it("given a product already routed at the venue, when that product is saved again, then the duplicate is not saved", async () => {
  const client = await openClient();
  const repository = new DrizzleStationRouteRepository(client);
  const saved = grillRoute(TENANT_A);

  await repository.save(saved);
  await repository.save({
    ...saved,
    stationId: "station_bar",
    stationName: "Bar",
    output: "printer",
    redThresholdMinutes: 4,
  });

  const loaded = await repository.load(TENANT_A, VENUE_ID);
  const routes = await client.query<{
    id: string;
    venue_id: string;
    output: string;
    red_threshold_minutes: number;
  }>("SELECT id, venue_id, output, red_threshold_minutes FROM station_routes");
  const products = await client.query<{
    product_id: string;
    venue_id: string;
    station_id: string;
  }>("SELECT product_id, venue_id, station_id FROM station_route_products");

  expect(loaded).toEqual([saved]);
  expect(await repository.load(TENANT_B, VENUE_ID)).toEqual([]);
  expect(routes.rows).toEqual([
    {
      id: "station_grill",
      venue_id: VENUE_ID,
      output: "both",
      red_threshold_minutes: 15,
    },
  ]);
  expect(products.rows).toEqual([
    {
      product_id: "menu_steak",
      venue_id: VENUE_ID,
      station_id: "station_grill",
    },
  ]);
});
