import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, expect, it } from "vitest";

import {
  DrizzleNoRestockRepository,
  noRestockToday,
} from "#adapters/postgres/drizzle-no-restock-repository.js";
import { noRestockRepositoryContract } from "#application/ports/no-restock-repository.contract.js";

const catalogMigration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const noRestockMigration = readFileSync(
  fileURLToPath(new URL("./0007_no_restock_today.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_1";
const TENANT_B = "organization_tenant_2";
const VENUE_ID = "venue_site_1";
const PRODUCT_ID = "product_ribs";
const ACTOR_ID = "user_kitchen_chief";
const SERVICE_DATE = "2026-11-13";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(catalogMigration);
  await client.exec(noRestockMigration);
};

noRestockRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);

  return new DrizzleNoRestockRepository(client);
});

it("given marks for two tenants, when inventory_app reads no_restock_today with the local tenant, then the other tenant stays hidden", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  await client.exec(`
    INSERT INTO no_restock_today (
      tenant_id,
      venue_id,
      product_id,
      status,
      actor_id,
      service_date
    )
    VALUES
      ('${TENANT_A}', '${VENUE_ID}', '${PRODUCT_ID}', 'confirmed', '${ACTOR_ID}', '${SERVICE_DATE}'),
      ('${TENANT_B}', '${VENUE_ID}', '${PRODUCT_ID}', 'confirmed', '${ACTOR_ID}', '${SERVICE_DATE}')
  `);

  const database = drizzle({ client });
  const rows = await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE inventory_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`,
    );

    return tx
      .select({ tenantId: noRestockToday.tenantId })
      .from(noRestockToday);
  });

  expect(rows.map((row) => row.tenantId)).toEqual([TENANT_A]);
});
