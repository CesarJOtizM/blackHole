import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleSalesDocumentRepository } from "#adapters/postgres/drizzle-sales-document-repository.js";
import { salesDocumentRepositoryContract } from "#application/ports/sales-document-repository.contract.js";

const taxMigration = readFileSync(
  fileURLToPath(new URL("./0009_tax.sql", import.meta.url)),
  "utf8",
);
const migration = readFileSync(
  fileURLToPath(new URL("./0011_electronic_invoicing.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const REFERENCE_A = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const REFERENCE_B = "01932f4a-7c3a-7b2d-9e1f-6a5b4c3d2e10";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(taxMigration);
  await client.exec(migration);

  return client;
};

salesDocumentRepositoryContract(async () => {
  const client = await open();

  return {
    forTenant: (tenantId) =>
      new DrizzleSalesDocumentRepository(client, tenantId),
  };
});

it("given sales documents for tenants A and B, when invoicing_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO sales_documents (
      tenant_id, closure_id, reference_code, status, hold_reason, buyer, content
    ) VALUES
      (
        '${TENANT_A}', 'closure_a', '${REFERENCE_A}', 'generated', NULL,
        '{"documentType":"13"}'::jsonb, '{"numberingRangeId":"range_site"}'::jsonb
      ),
      (
        '${TENANT_B}', 'closure_b', '${REFERENCE_B}', 'generated', NULL,
        '{"documentType":"13"}'::jsonb, '{"numberingRangeId":"range_site"}'::jsonb
      )
  `);
  await client.exec("SET ROLE invoicing_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const selected = await client.query<{ closure_id: string }>(
    "SELECT closure_id FROM sales_documents",
  );

  expect(selected.rows.map((row) => row.closure_id)).toEqual(["closure_a"]);
});

it("given a stored sales document, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO sales_documents (
      tenant_id, closure_id, reference_code, status, hold_reason, buyer, content
    ) VALUES (
      '${TENANT_A}', 'closure_owner', '${REFERENCE_A}', 'pending_issuance',
      'no_balance',
      '{"documentType":"13"}'::jsonb, '{"numberingRangeId":"range_site"}'::jsonb
    )
  `);

  await expect(
    client.exec("UPDATE sales_documents SET status = 'accepted'"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM sales_documents")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE sales_documents")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{
    closure_id: string;
    status: string;
  }>("SELECT closure_id, status FROM sales_documents");

  expect(selected.rows).toEqual([
    { closure_id: "closure_owner", status: "pending_issuance" },
  ]);
});

it("given the electronic invoicing migration, when row security is read, then it is enabled and forced for invoicing_app", () => {
  const sql = migration.toLowerCase();

  expect(sql).toContain("sales_documents");
  expect(sql).toContain("primary key (tenant_id, closure_id)");
  expect(sql).not.toContain("create role");
  expect(sql).toContain("invoicing_app");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain("grant select, insert on sales_documents");
  expect(sql).toContain("invoicing_reject_mutation");
  expect(sql).not.toContain("grant select, insert, update, delete");
  expect(sql).not.toContain("create role invoicing_app");
});
