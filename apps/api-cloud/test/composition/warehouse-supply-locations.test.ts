import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { WarehouseSupplyLocations } from "#src/composition/warehouse-supply-locations.js";

const organizationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../contexts/platform/adapters/postgres/0002_organization.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const supplySql = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../contexts/platform/adapters/postgres/0015_warehouse_supplies.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_a";
const WAREHOUSE_ID = "organization_warehouse_central";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

it("given a venue supplied by one warehouse, when location ids are read, then that warehouse id is returned", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(organizationSql);
  await client.exec(supplySql);
  await client.query(
    `INSERT INTO warehouse_supplies (tenant_id, venue_id, warehouse_location_id)
     VALUES ($1, $2, $3)`,
    [TENANT_ID, VENUE_ID, WAREHOUSE_ID],
  );

  const locations = await new WarehouseSupplyLocations(client).locationIds(
    TENANT_ID,
    VENUE_ID,
  );

  expect(locations).toEqual([WAREHOUSE_ID]);
});
