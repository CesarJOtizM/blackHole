import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const organizationMigration = readFileSync(
  fileURLToPath(new URL("./0002_organization.sql", import.meta.url)),
  "utf8",
);
const supplyMigration = readFileSync(
  fileURLToPath(new URL("./0015_warehouse_supplies.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_company_1";
const TENANT_B = "organization_company_2";
const VENUE_A = "organization_venue_a";
const CENTRAL_ID = "organization_warehouse_central";

it("given 0015_warehouse_supplies, when one tenant stores a link, then the other tenant cannot read it", async () => {
  const client = new PGlite();
  await client.exec(organizationMigration);
  await client.exec(supplyMigration);
  await client.exec("SET ROLE organization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);
  await client.query(
    `INSERT INTO warehouse_supplies (
      tenant_id,
      venue_id,
      warehouse_location_id
    )
    VALUES ($1, $2, $3)`,
    [TENANT_A, VENUE_A, CENTRAL_ID],
  );
  const visible = await client.query<{ warehouse_location_id: string }>(
    "SELECT warehouse_location_id FROM warehouse_supplies",
  );
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_B,
  ]);
  const hidden = await client.query<{ warehouse_location_id: string }>(
    "SELECT warehouse_location_id FROM warehouse_supplies",
  );

  expect(visible.rows).toEqual([{ warehouse_location_id: CENTRAL_ID }]);
  expect(hidden.rows).toEqual([]);
  await client.close();
});
