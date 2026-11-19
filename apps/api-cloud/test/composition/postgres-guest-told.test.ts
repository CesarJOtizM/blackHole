import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { PostgresGuestTold } from "#src/composition/postgres-guest-told.js";

const ordersSql = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../contexts/orders/adapters/postgres/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "venue_site_1";
const CHECK_ID = "check_1";
const LINE_ID = "line_ribs";
const ACTOR_ID = "user_waiter";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

it("given a guest-told mark saved for a withdrawn line, when a new repository reads the same database, then the actor is returned", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(ordersSql("0001_menu.sql"));
  await client.exec(ordersSql("0002_dining_room.sql"));
  await client.exec(ordersSql("0007_no_restock_withdrawal.sql"));
  await client.exec(ordersSql("0009_guest_told.sql"));
  await client.query(
    `INSERT INTO order_lines (
      id, tenant_id, venue_id, check_id, order_id, product_id, name, course,
      price, state, origin_table_id, variant_ids, modifier_ids, position,
      not_delivered_at, guest_told_actor_id
    ) VALUES (
      $1, $2, $3, $4, 'order_1', 'product_ribs', 'Ribs', 1,
      12000, 'not_delivered', 'table_1', '[]'::jsonb, '[]'::jsonb, 0,
      '2026-11-19T17:00:00.000Z', NULL
    )`,
    [LINE_ID, TENANT_ID, VENUE_ID, CHECK_ID],
  );
  await new PostgresGuestTold(client).save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: LINE_ID,
    actorId: ACTOR_ID,
  });

  const stored = await new PostgresGuestTold(client).find({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: LINE_ID,
  });

  expect(stored).toEqual({
    checkId: CHECK_ID,
    lineId: LINE_ID,
    actorId: ACTOR_ID,
  });
});
