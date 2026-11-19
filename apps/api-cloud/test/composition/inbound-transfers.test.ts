import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { PostgresInboundTransfers } from "#src/composition/inbound-transfers.js";

const migration = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../contexts/inventory/adapters/postgres/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const POINT_ID = "organization_point_1";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

it("given a transfer in transit to the venue point, when statuses are read, then only that tenant's open transfer is returned", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0004_transfers.sql"));
  await client.exec(`
    INSERT INTO transfers (
      tenant_id, id, origin_location_id, destination_location_id, status
    ) VALUES
      ('${TENANT_ID}', 'transfer_open', 'organization_warehouse_1', '${POINT_ID}', 'in_transit'),
      ('${TENANT_ID}', 'transfer_done', 'organization_warehouse_1', '${POINT_ID}', 'received'),
      ('${OTHER_TENANT_ID}', 'transfer_other', 'organization_warehouse_1', '${POINT_ID}', 'in_transit')
  `);
  const reader = new PostgresInboundTransfers(client, async () => [POINT_ID]);

  await expect(reader.statuses(TENANT_ID, VENUE_ID)).resolves.toEqual([
    { status: "in_transit" },
  ]);
});
