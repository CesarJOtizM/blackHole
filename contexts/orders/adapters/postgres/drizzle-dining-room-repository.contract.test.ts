import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleDiningRoomRepository } from "#adapters/postgres/drizzle-dining-room-repository.js";
import { diningRoomRepositoryContract } from "#application/ports/dining-room-repository.contract.js";
import { Check } from "#domain/check.js";

const TENANT_A = "organization_tenant_a";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const OTHER_CHECK_ID = "check_6";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const PREPARED_AT = "2026-10-28T12:04:00.000Z";
const READY_AT = "2026-10-28T12:06:00.000Z";

const menuMigration = readFileSync(
  fileURLToPath(new URL("./0001_menu.sql", import.meta.url)),
  "utf8",
);
const diningMigration = readFileSync(
  fileURLToPath(new URL("./0002_dining_room.sql", import.meta.url)),
  "utf8",
);
const waiterColumn = "ALTER TABLE checks ADD COLUMN waiter_id text";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const applyMigrations = async (client: PGlite): Promise<void> => {
  await client.exec(menuMigration);
  await client.exec(diningMigration);
  await client.exec(waiterColumn);
};

diningRoomRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await applyMigrations(client);

  return new DrizzleDiningRoomRepository(client);
});

const errorText = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  return `${error.message}\n${errorText(error.cause)}`;
};

const openClient = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await applyMigrations(client);

  return client;
};

const servedCheck = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_1",
    lineId: "line_soup",
    productId: "menu_soup",
    name: "Jalapeño soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
    variantIds: ["menu_variant_cup"],
    modifierIds: ["menu_modifier_cream"],
    note: "no onion",
  });
  check.addLine({
    orderId: "order_1",
    lineId: "line_steak",
    productId: "menu_steak",
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.advance({
    lineId: "line_soup",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_soup", state: "ready", at: READY_AT });
  check.requestCheck({ requestedAt: READY_AT });

  return check;
};

it("given dining tables, checks, orders, and lines for tenants A and B, when orders_app selects them without a tenant filter, then only tenant A returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await applyMigrations(client);
  await client.exec(`
    INSERT INTO dining_tables (id, tenant_id, venue_id, zone, state, diners)
    VALUES
      ('table_a', 'organization_tenant_a', 'organization_venue_1', 'Terrace', 'occupied', 4),
      ('table_b', 'organization_tenant_b', 'organization_venue_1', 'Terrace', 'occupied', 2);

    INSERT INTO checks (
      id,
      tenant_id,
      venue_id,
      table_id,
      opened_at,
      table_state
    )
    VALUES
      (
        'check_a',
        'organization_tenant_a',
        'organization_venue_1',
        'table_a',
        '2026-10-28T12:00:00.000Z',
        'occupied'
      ),
      (
        'check_b',
        'organization_tenant_b',
        'organization_venue_1',
        'table_b',
        '2026-10-28T12:00:00.000Z',
        'occupied'
      );

    INSERT INTO orders (
      id, tenant_id, venue_id, check_id, channel, position
    )
    VALUES
      (
        'order_a',
        'organization_tenant_a',
        'organization_venue_1',
        'check_a',
        'waiter',
        0
      ),
      (
        'order_b',
        'organization_tenant_b',
        'organization_venue_1',
        'check_b',
        'waiter',
        0
      );

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
      position
    )
    VALUES
      (
        'line_a',
        'organization_tenant_a',
        'organization_venue_1',
        'check_a',
        'order_a',
        'menu_soup',
        'Soup',
        1,
        1000,
        'held',
        'table_a',
        '[]',
        '[]',
        0
      ),
      (
        'line_b',
        'organization_tenant_b',
        'organization_venue_1',
        'check_b',
        'order_b',
        'menu_soup',
        'Soup',
        1,
        1000,
        'held',
        'table_b',
        '[]',
        '[]',
        0
      )
  `);
  await client.exec("SET ROLE orders_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_tenant_a",
  ]);

  const tables = await client.query<{ id: string }>(
    "SELECT id FROM dining_tables",
  );
  const storedChecks = await client.query<{ id: string }>(
    "SELECT id FROM checks",
  );
  const storedOrders = await client.query<{ id: string }>(
    "SELECT id FROM orders",
  );
  const storedLines = await client.query<{ id: string }>(
    "SELECT id FROM order_lines",
  );

  expect(tables.rows.map((row) => row.id)).toEqual(["table_a"]);
  expect(storedChecks.rows.map((row) => row.id)).toEqual(["check_a"]);
  expect(storedOrders.rows.map((row) => row.id)).toEqual(["order_a"]);
  expect(storedLines.rows.map((row) => row.id)).toEqual(["line_a"]);
});

it("given a join, when both checks are saved, then they commit together", async () => {
  const client = await openClient();
  const repository = new DrizzleDiningRoomRepository(client);
  const first = servedCheck();
  const second = Check.open({
    id: OTHER_CHECK_ID,
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    tableId: "table_6",
    openedAt: OPENED_AT,
  });

  await client.exec(`
    CREATE OR REPLACE FUNCTION abort_joined_check()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.id = 'check_6' THEN
        RAISE EXCEPTION 'join aborted';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER abort_joined_check
    BEFORE INSERT ON checks
    FOR EACH ROW
    EXECUTE FUNCTION abort_joined_check();
  `);

  let aborted = false;

  try {
    await repository.saveChecks([first, second]);
  } catch (error) {
    aborted = errorText(error).includes("join aborted");
  }

  expect(aborted).toBe(true);

  const checksAfterAbort = await client.query<{ id: string }>(
    "SELECT id FROM checks",
  );
  const ordersAfterAbort = await client.query<{ id: string }>(
    "SELECT id FROM orders",
  );
  const linesAfterAbort = await client.query<{ id: string }>(
    "SELECT id FROM order_lines",
  );

  expect(checksAfterAbort.rows).toEqual([]);
  expect(ordersAfterAbort.rows).toEqual([]);
  expect(linesAfterAbort.rows).toEqual([]);

  await client.exec("DROP TRIGGER abort_joined_check ON checks");
  await repository.saveChecks([first, second]);

  const committedChecks = await client.query<{ id: string }>(
    "SELECT id FROM checks ORDER BY id",
  );
  const committedOrders = await client.query<{ check_id: string }>(
    "SELECT check_id FROM orders ORDER BY check_id",
  );
  const committedLines = await client.query<{ id: string }>(
    "SELECT id FROM order_lines ORDER BY position",
  );

  expect(committedChecks.rows.map((row) => row.id)).toEqual([
    CHECK_ID,
    OTHER_CHECK_ID,
  ]);
  expect(committedOrders.rows.map((row) => row.check_id)).toEqual([CHECK_ID]);
  expect(committedLines.rows.map((row) => row.id)).toEqual([
    "line_soup",
    "line_steak",
  ]);
});

it("given a commit, when orders are saved, then NOTIFY orders_realtime carries ids only", async () => {
  const client = await openClient();
  const repository = new DrizzleDiningRoomRepository(client);
  const payloads: string[] = [];

  await client.listen("orders_realtime", (payload) => {
    payloads.push(payload);
  });

  await repository.saveCheck(servedCheck());
  await client.query("SELECT 1");

  expect(payloads).toHaveLength(1);
  const notice = JSON.parse(payloads[0] ?? "") as {
    kind: string;
    tenantId: string;
    venueId: string;
    checkId: string;
    tableId: string;
    lineIds: string[];
  };

  expect(notice).toEqual({
    kind: "ids",
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    tableId: TABLE_ID,
    lineIds: ["line_soup", "line_steak"],
  });
  expect(payloads[0]).not.toContain("Jalapeño");
  expect(payloads[0]).not.toContain("no onion");
  expect(payloads[0]).not.toContain("Steak");
  expect(payloads[0]).not.toContain("12000");
  expect(payloads[0]).not.toContain("45000");
  expect(notice).not.toHaveProperty("text");
  expect(notice).not.toHaveProperty("name");
});

it("given a line state, when the line is saved, then its timestamp is stored", async () => {
  const client = await openClient();
  const repository = new DrizzleDiningRoomRepository(client);

  await repository.saveCheck(servedCheck());

  const lines = await client.query<{
    id: string;
    state: string;
    sent_at: string | null;
    in_preparation_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
  }>(`
    SELECT
      id,
      state,
      sent_at,
      in_preparation_at,
      ready_at,
      delivered_at
    FROM order_lines
    ORDER BY id
  `);

  expect(lines.rows).toEqual([
    {
      id: "line_soup",
      state: "ready",
      sent_at: SENT_AT,
      in_preparation_at: PREPARED_AT,
      ready_at: READY_AT,
      delivered_at: null,
    },
    {
      id: "line_steak",
      state: "held",
      sent_at: null,
      in_preparation_at: null,
      ready_at: null,
      delivered_at: null,
    },
  ]);
});

it("given a transferred check, when it is saved and loaded, then the waiter still owns it", async () => {
  const client = await openClient();
  const repository = new DrizzleDiningRoomRepository(client);
  const check = servedCheck();

  check.assignWaiter("user_waiter");
  await repository.saveCheck(check);

  const stored = await repository.loadCheck(TENANT_A, VENUE_ID, CHECK_ID);
  const row = await client.query<{ waiter_id: string | null }>(
    "SELECT waiter_id FROM checks",
  );

  expect(stored?.waiterId).toBe("user_waiter");
  expect(row.rows).toEqual([{ waiter_id: "user_waiter" }]);
});
