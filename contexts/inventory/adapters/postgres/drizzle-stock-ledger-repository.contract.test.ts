import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import {
  DrizzlePointOfSaleDirectory,
  DrizzleStockLedgerRepository,
} from "#adapters/postgres/drizzle-stock-ledger-repository.js";
import { stockLedgerRepositoryContract } from "#application/ports/stock-ledger-repository.contract.js";

const catalogMigration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const ledgerMigration = readFileSync(
  fileURLToPath(new URL("./0002_stock_ledger.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const LOCATION_A = "location_point_of_sale_a";
const LOCATION_B = "location_point_of_sale_b";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const openClient = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);

  return client;
};

stockLedgerRepositoryContract(async () => {
  const client = await openClient();
  const repository = new DrizzleStockLedgerRepository(client);

  return {
    repository,
    failOnInsert: (ordinal) => {
      repository.failOnInsert(ordinal);
    },
    queued: (tenantId) => repository.queued(tenantId),
  };
});

it("given movements for tenants A and B, when inventory_app selects them without a tenant filter, then only tenant A returns", async () => {
  const client = await openClient();

  await client.exec(`
    INSERT INTO stock_movements (
      tenant_id,
      id,
      position,
      venue_id,
      location_id,
      ingredient_id,
      quantity,
      unit_cost,
      movement_type,
      reference,
      occurred_at,
      order_line_id,
      role,
      recipe_version
    )
    VALUES
      (
        'organization_tenant_a',
        'movement_tenant_a',
        1,
        'venue_site',
        'location_point_of_sale',
        'ingredient_beef',
        -200000,
        1500,
        'sale_consumption',
        'line_tenant_a',
        '2026-11-13T18:00:00.000Z',
        'line_tenant_a',
        'consumption',
        4
      ),
      (
        'organization_tenant_b',
        'movement_tenant_b',
        1,
        'venue_site',
        'location_point_of_sale',
        'ingredient_beef',
        -500000,
        1500,
        'sale_consumption',
        'line_tenant_b',
        '2026-11-13T18:00:00.000Z',
        'line_tenant_b',
        'consumption',
        4
      )
  `);
  await client.exec("SET ROLE inventory_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM stock_movements ORDER BY id",
  );

  expect(selected.rows.map((row) => row.id)).toEqual(["movement_tenant_a"]);
});

it("given a stored movement, when inventory_app updates it, then the update is rejected", async () => {
  const client = await openClient();

  await client.exec(`
    INSERT INTO stock_movements (
      tenant_id,
      id,
      position,
      venue_id,
      location_id,
      ingredient_id,
      quantity,
      unit_cost,
      movement_type,
      reference,
      occurred_at,
      order_line_id,
      role,
      recipe_version
    )
    VALUES (
      'organization_tenant_a',
      'movement_locked',
      1,
      'venue_site',
      'location_point_of_sale',
      'ingredient_beef',
      -200000,
      1500,
      'sale_consumption',
      'line_locked',
      '2026-11-13T18:00:00.000Z',
      'line_locked',
      'consumption',
      4
    )
  `);
  await client.exec("SET ROLE inventory_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  await expect(
    client.query("UPDATE stock_movements SET quantity = 1"),
  ).rejects.toThrow();

  const selected = await client.query<{ quantity: number }>(
    "SELECT quantity FROM stock_movements WHERE id = 'movement_locked'",
  );

  expect(selected.rows).toEqual([{ quantity: -200000 }]);
});

it("given a point-of-sale location for each tenant, when tenant A reads the venue, then tenant B stays hidden", async () => {
  const client = await openClient();
  const directory = new DrizzlePointOfSaleDirectory(client);

  await directory.remember(TENANT_A, VENUE_ID, LOCATION_A);
  await directory.remember(TENANT_B, VENUE_ID, LOCATION_B);

  expect(await directory.locationOf(TENANT_A, VENUE_ID)).toBe(LOCATION_A);
  expect(await directory.locationOf(TENANT_B, VENUE_ID)).toBe(LOCATION_B);
});
