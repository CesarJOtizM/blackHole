import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, expect, it } from "vitest";

const menuMigration = readFileSync(
  fileURLToPath(new URL("./0001_menu.sql", import.meta.url)),
  "utf8",
);
const diningMigration = readFileSync(
  fileURLToPath(new URL("./0002_dining_room.sql", import.meta.url)),
  "utf8",
);
const withdrawalMigration = readFileSync(
  fileURLToPath(new URL("./0007_no_restock_withdrawal.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_1";
const TENANT_B = "organization_tenant_2";
const NOT_DELIVERED_AT = "2026-11-14T04:59:00.000Z";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(menuMigration);
  await client.exec(diningMigration);
  await client.exec(withdrawalMigration);
};

const line = (id: string, tenantId: string, actorId: string): string =>
  `('${id}', '${tenantId}', 'venue_site_1', 'check_1', 'order_1', 'product_ribs', 'Ribs', 1, 12000, 'not_delivered', 'table_1', '[]'::jsonb, '[]'::jsonb, 0, '${NOT_DELIVERED_AT}', '${actorId}')`;

it("given a withdrawn line for tenant A, when orders_app reads order_lines with the local tenant, then the other tenant stays hidden and the withdrawal columns remain", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  await client.exec(`
    INSERT INTO order_lines (
      id,
      tenant_id,
      venue_id,
      check_id,
      order_id,
      product_id,
      name,
      course,
      price,
      state,
      origin_table_id,
      variant_ids,
      modifier_ids,
      position,
      not_delivered_at,
      guest_told_actor_id
    )
    VALUES
      ${line("line_a", TENANT_A, "user_waiter")},
      ${line("line_b", TENANT_B, "user_other")}
  `);

  const database = drizzle({ client });
  const selected = await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE orders_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`,
    );

    return tx.execute<{
      tenant_id: string;
      not_delivered_at: string;
      guest_told_actor_id: string;
    }>(sql`
      SELECT tenant_id, not_delivered_at, guest_told_actor_id
      FROM order_lines
    `);
  });
  const rows = Array.isArray(selected) ? selected : selected.rows;

  expect(rows).toEqual([
    {
      tenant_id: TENANT_A,
      not_delivered_at: NOT_DELIVERED_AT,
      guest_told_actor_id: "user_waiter",
    },
  ]);
});
