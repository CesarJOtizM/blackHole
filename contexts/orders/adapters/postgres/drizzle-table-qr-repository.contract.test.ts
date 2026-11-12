import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleTableQrRepository } from "#adapters/postgres/drizzle-table-qr-repository.js";
import { TableQrToken } from "#domain/table-qr-token.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const NONCE_A = "table-qr-nonce-0001";
const NONCE_B = "table-qr-nonce-0002";

const migrations = [
  "0001_menu.sql",
  "0002_dining_room.sql",
  "0003_check_waiter.sql",
  "0004_qr_table_ordering.sql",
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

it("given a retired token and another tenant's token, when tenant A reads table QR rows, then the retired token stays and the other tenant is hidden", async () => {
  const client = new PGlite();
  clients.push(client);
  await applyMigrations(client);
  const tokens = new DrizzleTableQrRepository(client);
  const current = TableQrToken.issue({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: NONCE_A,
  });
  const foreign = TableQrToken.issue({
    tenantId: TENANT_B,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: NONCE_B,
  });

  await tokens.save({
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: current.digest,
    retired: false,
  });
  await tokens.retireActive(TENANT_A, VENUE_ID, TABLE_ID);
  await tokens.save({
    tenantId: TENANT_B,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: foreign.digest,
    retired: false,
  });

  await client.exec("SET ROLE orders_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);
  const rows = await client.query<{
    tenant_id: string;
    digest: string;
    retired: boolean;
  }>("SELECT tenant_id, digest, retired FROM table_qr_tokens");

  expect(await tokens.findByDigest(current.digest)).toMatchObject({
    tenantId: TENANT_A,
    retired: true,
  });
  expect(rows.rows).toEqual([
    { tenant_id: TENANT_A, digest: current.digest, retired: true },
  ]);
});
