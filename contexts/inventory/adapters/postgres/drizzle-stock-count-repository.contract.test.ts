import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import {
  DrizzleIngredientClassification,
  DrizzleStockCountRepository,
} from "#adapters/postgres/drizzle-stock-count-repository.js";
import { DrizzleStockLedgerRepository } from "#adapters/postgres/drizzle-stock-ledger-repository.js";
import { stockCountRepositoryContract } from "#application/ports/stock-count-repository.contract.js";
import {
  COUNT_LINE_ROLE,
  type CountLedgerLine,
} from "#application/ports/stock-count-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const catalogMigration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_catalog.sql", import.meta.url)),
  "utf8",
);
const ledgerMigration = readFileSync(
  fileURLToPath(new URL("./0002_stock_ledger.sql", import.meta.url)),
  "utf8",
);
const productionMigration = readFileSync(
  fileURLToPath(new URL("./0006_production.sql", import.meta.url)),
  "utf8",
);
const wasteAndCountsMigration = readFileSync(
  fileURLToPath(new URL("./0008_waste_and_counts.sql", import.meta.url)),
  "utf8",
);
const wasteCountOutboxMigration = readFileSync(
  fileURLToPath(new URL("./0010_waste_count_outbox.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const migrate = async (client: PGlite): Promise<void> => {
  await client.exec(catalogMigration);
  await client.exec(ledgerMigration);
  await client.exec(productionMigration);
  await client.exec(wasteAndCountsMigration);
  await client.exec(wasteCountOutboxMigration);
};

stockCountRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  const repository = new DrizzleStockCountRepository(client);
  const classifications = new DrizzleIngredientClassification(client);

  return {
    repository,
    classifications,
    knowIngredient: (tenantId, ingredientId) => {
      classifications.know(tenantId, ingredientId);
    },
    session: (tenantId, documentId) =>
      repository.sessionOf(tenantId, documentId),
    stock: (tenantId, locationId, ingredientId) =>
      repository.stockOf(tenantId, locationId, ingredientId),
    seed: (line) => repository.seed(line),
    reject: (tenantId, documentId) => repository.reject(tenantId, documentId),
  };
});

it("given the waste and counts migration, when the database is still empty, then session, line, and classification tables exist and no movement was backfilled", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'count_sessions',
        'count_session_lines',
        'ingredient_classifications',
        'production_runs',
        'production_cost_policies',
        'preparation_standard_costs'
      )
    ORDER BY table_name
  `);
  const outputQuantity = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'output_quantity'
    ORDER BY table_name
  `);
  const movements = await client.query<{ count: number | string }>(
    "SELECT count(*) AS count FROM stock_movements",
  );

  expect(tables.rows.map((row) => row.table_name)).toEqual([
    "count_session_lines",
    "count_sessions",
    "ingredient_classifications",
    "preparation_standard_costs",
    "production_cost_policies",
    "production_runs",
  ]);
  expect(outputQuantity.rows.map((row) => row.table_name)).toEqual([
    "recipe_versions",
    "recipes",
  ]);
  expect(Number(movements.rows[0]?.count)).toBe(0);
});

const TENANT_A = "organization_tenant_a";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";
const ACTOR_ID = "user_kitchen_chief";
const CUT_OFF = "2026-11-13T18:00:00.000Z";
const AVERAGE_COST = 1_500;
const COUNT_DOCUMENT = "count_milk_within_cap";
const WASTE_DOCUMENT = "waste_milk_expired";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const documentLine = (
  input: Pick<
    CountLedgerLine,
    "id" | "quantity" | "type" | "role" | "orderLineId" | "occurredAt"
  > &
    Partial<CountLedgerLine>,
): CountLedgerLine => ({
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: MILK_ID,
  unitCost: AVERAGE_COST,
  reference: input.orderLineId,
  recipeVersion: 0,
  reason: null,
  actorId: ACTOR_ID,
  ...input,
});

const openRepository = async (): Promise<{
  client: PGlite;
  repository: DrizzleStockCountRepository;
}> => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);

  return {
    client,
    repository: new DrizzleStockCountRepository(client),
  };
};

const balanceOf = async (
  client: PGlite,
  ingredientId: string,
): Promise<number | null> => {
  const selected = await client.query<{ quantity: number | string }>(
    `SELECT quantity
     FROM stock_balances
     WHERE tenant_id = $1
       AND location_id = $2
       AND ingredient_id = $3`,
    [TENANT_A, LOCATION_ID, ingredientId],
  );
  const quantity = selected.rows[0]?.quantity;

  return quantity === undefined ? null : Number(quantity);
};

const outboxOf = async (
  client: PGlite,
): Promise<
  {
    movement_id: string;
    role: string;
    lane: string;
    movement_type: string;
    quantity: number;
    order_line_id: string;
    recipe_version: number;
  }[]
> => {
  const selected = await client.query<{
    movement_id: string;
    role: string;
    lane: string;
    movement_type: string;
    quantity: number | string;
    order_line_id: string;
    recipe_version: number | string;
  }>(
    `SELECT movement_id, role, lane, movement_type, quantity,
            order_line_id, recipe_version
     FROM stock_movement_outbox
     WHERE tenant_id = $1
     ORDER BY position`,
    [TENANT_A],
  );

  return selected.rows.map((row) => ({
    movement_id: row.movement_id,
    role: row.role,
    lane: row.lane,
    movement_type: row.movement_type,
    quantity: Number(row.quantity),
    order_line_id: row.order_line_id,
    recipe_version: Number(row.recipe_version),
  }));
};

it("given a count adjustment of -600 g, when that line is appended, then the balance and the outbox row are stored with the movement", async () => {
  const { client, repository } = await openRepository();
  const adjustment = documentLine({
    id: `movement_${COUNT_DOCUMENT}_${MILK_ID}`,
    quantity: grams(-600),
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
    orderLineId: COUNT_DOCUMENT,
    occurredAt: CUT_OFF,
  });

  await repository.appendAdjustments([adjustment]);

  expect(await balanceOf(client, MILK_ID)).toBe(grams(-600));
  expect(await outboxOf(client)).toEqual([
    {
      movement_id: adjustment.id,
      role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
      lane: "after_sales",
      movement_type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(-600),
      order_line_id: COUNT_DOCUMENT,
      recipe_version: 0,
    },
  ]);
});

it("given a sale consumption and a posted count for the same ingredient, when that count document, role, and ingredient are appended again, then the sale row stays and the balance is not applied twice", async () => {
  const { client, repository } = await openRepository();
  const sale = documentLine({
    id: "movement_milk_sale",
    quantity: grams(-200),
    type: MOVEMENT_TYPE.SALE_CONSUMPTION,
    role: COUNT_LINE_ROLE.CONSUMPTION,
    orderLineId: "line_milk_sale",
    occurredAt: "2026-11-13T17:00:00.000Z",
    recipeVersion: 4,
    actorId: null,
  });
  const adjustment = documentLine({
    id: `movement_${COUNT_DOCUMENT}_${MILK_ID}`,
    quantity: grams(-600),
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
    orderLineId: COUNT_DOCUMENT,
    occurredAt: CUT_OFF,
  });
  const retry = documentLine({
    id: `movement_${COUNT_DOCUMENT}_${MILK_ID}_retry`,
    quantity: grams(-600),
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
    orderLineId: COUNT_DOCUMENT,
    occurredAt: CUT_OFF,
  });

  await repository.seed(sale);
  await client.exec(`
    INSERT INTO stock_balances (
      tenant_id,
      location_id,
      ingredient_id,
      quantity
    )
    VALUES (
      '${TENANT_A}',
      '${LOCATION_ID}',
      '${MILK_ID}',
      ${grams(-200)}
    )
  `);
  await repository.appendAdjustments([adjustment]);
  await repository.appendAdjustments([retry]);

  const movements = await client.query<{
    id: string;
    movement_type: string;
    role: string;
    quantity: number | string;
  }>(
    `SELECT id, movement_type, role, quantity
     FROM stock_movements
     ORDER BY position`,
  );

  expect(await balanceOf(client, MILK_ID)).toBe(grams(-800));
  expect(
    movements.rows.map((row) => ({
      id: row.id,
      movement_type: row.movement_type,
      role: row.role,
      quantity: Number(row.quantity),
    })),
  ).toEqual([
    {
      id: sale.id,
      movement_type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      role: COUNT_LINE_ROLE.CONSUMPTION,
      quantity: grams(-200),
    },
    {
      id: adjustment.id,
      movement_type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
      quantity: grams(-600),
    },
  ]);
  expect(await outboxOf(client)).toEqual([
    {
      movement_id: adjustment.id,
      role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
      lane: "after_sales",
      movement_type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(-600),
      order_line_id: COUNT_DOCUMENT,
      recipe_version: 0,
    },
  ]);
});

it("given an operational waste, when the ledger posts that document line and the same line is posted again, then the balance and the outbox stay on the first row", async () => {
  const client = new PGlite();
  clients.push(client);
  await migrate(client);
  const ledger = new DrizzleStockLedgerRepository(client);
  const waste = {
    id: `movement_${WASTE_DOCUMENT}_${MILK_ID}`,
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: MILK_ID,
    quantity: grams(-1000),
    unitCost: AVERAGE_COST,
    type: MOVEMENT_TYPE.WASTE,
    reference: WASTE_DOCUMENT,
    occurredAt: CUT_OFF,
    orderLineId: WASTE_DOCUMENT,
    role: COUNT_LINE_ROLE.OPERATIONAL_WASTE,
    recipeVersion: 0,
    reason: "expired",
    actorId: ACTOR_ID,
  };
  const retry = {
    ...waste,
    id: `movement_${WASTE_DOCUMENT}_${MILK_ID}_retry`,
  };

  await ledger.append({ movements: [waste], alerts: [] });
  await ledger.append({ movements: [retry], alerts: [] });

  const movements = await client.query<{ id: string }>(
    "SELECT id FROM stock_movements ORDER BY position",
  );

  expect(await balanceOf(client, MILK_ID)).toBe(grams(-1000));
  expect(movements.rows.map((row) => row.id)).toEqual([waste.id]);
  expect(await outboxOf(client)).toEqual([
    {
      movement_id: waste.id,
      role: COUNT_LINE_ROLE.OPERATIONAL_WASTE,
      lane: "after_sales",
      movement_type: MOVEMENT_TYPE.WASTE,
      quantity: grams(-1000),
      order_line_id: WASTE_DOCUMENT,
      recipe_version: 0,
    },
  ]);
});
