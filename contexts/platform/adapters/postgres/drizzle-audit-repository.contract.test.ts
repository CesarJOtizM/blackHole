import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleAuditRepository } from "#adapters/postgres/drizzle-audit-repository.js";
import { auditRepositoryContract } from "#application/ports/audit-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0007_audit.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);

  return client;
};

auditRepositoryContract(async () => {
  const client = await open();

  return new DrizzleAuditRepository(client);
});

it("given companies A and B, when audit_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO audit_events (
      id, tenant_id, actor_id, authorizer_id, device_id, site_id, action,
      entity, before_value, after_value, reason, occurred_at, sequence,
      previous_hash, digest, record_kind
    ) VALUES
      (
        'audit_a', 'organization_company_a', 'user_a', NULL, 'device_phone',
        'organization_venue_a', 'sale.void-account', 'check_1', '{}', '{}',
        'stored', 1, 1, '${"0".repeat(64)}', '${"ab".repeat(32)}', 'event'
      ),
      (
        'audit_b', 'organization_company_b', 'user_b', NULL, 'device_phone',
        'organization_venue_b', 'sale.void-account', 'check_1', '{}', '{}',
        'stored', 1, 1, '${"0".repeat(64)}', '${"cd".repeat(32)}', 'event'
      )
  `);
  await client.exec("SET ROLE audit_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  const selected = await client.query<{ actor_id: string }>(
    "SELECT actor_id FROM audit_events",
  );

  expect(selected.rows.map((row) => row.actor_id)).toEqual(["user_a"]);
});

it("given audit_app, when it inserts a row for the current tenant, then the insert is kept", async () => {
  const client = await open();
  await client.exec("SET ROLE audit_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  await client.exec(`
    INSERT INTO audit_events (
      id, tenant_id, actor_id, authorizer_id, device_id, site_id, action,
      entity, before_value, after_value, reason, occurred_at, sequence,
      previous_hash, digest, record_kind
    ) VALUES (
      'audit_insert', 'organization_company_a', 'user_a', NULL, 'device_phone',
      'organization_venue_a', 'sale.void-account', 'check_1', '{}', '{}',
      'stored', 1, 1, '${"0".repeat(64)}', '${"ab".repeat(32)}', 'event'
    )
  `);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM audit_events",
  );
  expect(selected.rows.map((row) => row.id)).toEqual(["audit_insert"]);
});

it("given a stored audit event, when the table owner updates or deletes it, then the trigger rejects both and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO audit_events (
      id, tenant_id, actor_id, authorizer_id, device_id, site_id, action,
      entity, before_value, after_value, reason, occurred_at, sequence,
      previous_hash, digest, record_kind
    ) VALUES (
      'audit_owner', 'organization_company_a', 'user_a', NULL, 'device_phone',
      'organization_venue_a', 'sale.void-account', 'check_1', '{}', '{}',
      'stored', 1, 1, '${"0".repeat(64)}', '${"ab".repeat(32)}', 'event'
    )
  `);

  await expect(
    client.exec("UPDATE audit_events SET reason = 'tampered'"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM audit_events")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ reason: string }>(
    "SELECT reason FROM audit_events",
  );
  expect(selected.rows).toEqual([{ reason: "stored" }]);
});

it("given the audit migration, when row security is read, then it is enabled and forced on app.tenant_id", () => {
  const sql = migration.toLowerCase();

  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain("grant select, insert");
  expect(sql).not.toContain("grant select, insert, update, delete");
});
