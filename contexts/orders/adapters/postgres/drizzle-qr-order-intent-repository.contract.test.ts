import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleDiningRoomRepository } from "#adapters/postgres/drizzle-dining-room-repository.js";
import { DrizzleQrOrderIntentRepository } from "#adapters/postgres/drizzle-qr-order-intent-repository.js";
import type { StoredQrOrderIntent } from "#application/ports/qr-order-intent-repository.js";
import { Check } from "#domain/check.js";

const TENANT_ID = "organization_tenant_a";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const INTENT_ID = "intent_1";
const OPENED_AT = "2026-10-28T17:03:10.000Z";

const migrations = [
  "0001_menu.sql",
  "0002_dining_room.sql",
  "0003_check_waiter.sql",
  "0004_qr_table_ordering.sql",
  "0005_report_stamps.sql",
  "0006_charge_stamp.sql",
] as const;

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const applyMigrations = async (client: PGlite): Promise<void> => {
  for (const name of migrations) {
    await client.exec(
      readFileSync(
        fileURLToPath(new URL(`./${name}`, import.meta.url)),
        "utf8",
      ),
    );
  }
};

const openClient = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await applyMigrations(client);

  return client;
};

const intent = (): StoredQrOrderIntent => ({
  id: INTENT_ID,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  status: "pending_acceptance",
  lines: [
    {
      productId: "menu_product_soup",
      name: "Soup",
      variantIds: [],
      modifierIds: [],
      unitPrice: 22_000,
    },
  ],
  unavailableProductIds: [],
  sentLineIds: [],
  checkId: null,
  createdAt: OPENED_AT,
});

it("given an intent id that is already stored, when it is inserted again, then the database keeps a single row", async () => {
  const intents = new DrizzleQrOrderIntentRepository(await openClient());

  await intents.insert(intent());
  await expect(intents.insert(intent())).rejects.toThrow();
  expect(await intents.find(TENANT_ID, INTENT_ID)).toEqual(intent());
});

it("given a QR table order, when the check is saved and loaded, then the channel round-trips", async () => {
  const dining = new DrizzleDiningRoomRepository(await openClient());
  const check = Check.open({
    id: "check_intent_1",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });
  check.addLine({
    orderId: "order_intent_1",
    lineId: "line_intent_1_0",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 22_000,
    channel: "qr_table",
  });

  await dining.saveCheck(check);
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_intent_1");

  expect(stored?.orders).toEqual([
    expect.objectContaining({
      channel: "qr_table",
      lines: [
        expect.objectContaining({ id: "line_intent_1_0", state: "held" }),
      ],
    }),
  ]);
});
