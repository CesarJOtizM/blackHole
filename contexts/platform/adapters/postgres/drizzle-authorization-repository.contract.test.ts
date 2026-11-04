import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleAuthorizationRepository } from "#adapters/postgres/drizzle-authorization-repository.js";
import { authorizationRepositoryContract } from "#application/ports/authorization-repository.contract.js";
import type { AuthorizationChanged } from "#application/ports/authorization-repository.js";
import {
  Authorization,
  AuthorizationAlreadyConsumed,
} from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0004_authorization.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

authorizationRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(readBindingMigration());

  return new DrizzleAuthorizationRepository(client);
});

it("given companies A and B, when authorization_app selects assignments without a tenant filter, then only the current tenant returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO authorization_assignments (
      id,
      tenant_id,
      user_id,
      role_id,
      scope_kind,
      scope_id,
      valid_from,
      valid_until,
      position
    )
    VALUES
      (
        'assignment_a',
        'organization_company_a',
        'user_owner_a',
        'cashier',
        'site',
        'organization_venue_a',
        NULL,
        NULL,
        0
      ),
      (
        'assignment_b',
        'organization_company_b',
        'user_owner_b',
        'cashier',
        'site',
        'organization_venue_b',
        NULL,
        NULL,
        0
      )
  `);
  await client.exec("SET ROLE authorization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  const selected = await client.query<{ user_id: string }>(
    "SELECT user_id FROM authorization_assignments",
  );

  expect(selected.rows.map((row) => row.user_id)).toEqual(["user_owner_a"]);
});

it("given the authorization migration, when its text is read, then it stores no PIN", () => {
  const sql = migration.toLowerCase();

  expect(sql).not.toMatch(/\bpin\b/);
  expect(sql).not.toContain("pin_hash");
});

it("given 0014_authorization_binding, when the new columns are described, then target_id is required, consumed_at stays null, and venue thresholds start at 5", async () => {
  const client = await openBound();

  const columns = await client.query<DescribedColumn>(`
    SELECT table_name, column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (
          table_name = 'authorization_requests'
          AND column_name IN ('target_id', 'consumed_at')
        )
        OR (
          table_name = 'authorization_venue_thresholds'
          AND column_name IN (
            'discount',
            'requester_authorizer_pair',
            'failed_pin'
          )
        )
      )
  `);

  expect(columnsByName(columns.rows)).toEqual({
    "authorization_requests.target_id": {
      column_default: null,
      is_nullable: "NO",
    },
    "authorization_requests.consumed_at": {
      column_default: null,
      is_nullable: "YES",
    },
    "authorization_venue_thresholds.discount": {
      column_default: "5",
      is_nullable: "NO",
    },
    "authorization_venue_thresholds.requester_authorizer_pair": {
      column_default: "5",
      is_nullable: "NO",
    },
    "authorization_venue_thresholds.failed_pin": {
      column_default: "5",
      is_nullable: "NO",
    },
  });
});

it("given a request written before the binding columns, when 0014_authorization_binding runs, then target_id copies venue_id and consumed_at stays null", async () => {
  const client = await openBase();
  await client.exec(`
    INSERT INTO authorizations (id, tenant_id)
    VALUES (
      'organization_company_legacy',
      'organization_company_legacy'
    );
    INSERT INTO authorization_requests (
      id,
      tenant_id,
      requester_id,
      permission,
      venue_id,
      value,
      reason,
      expires_at,
      status,
      position
    )
    VALUES (
      'request_legacy',
      'organization_company_legacy',
      'user_cashier',
      'sale.discount',
      'organization_venue_legacy',
      10,
      'guest',
      99,
      'pending',
      0
    );
  `);

  await client.exec(readBindingMigration());
  const stored = await client.query<{
    target_id: string;
    consumed_at: string | null;
  }>("SELECT target_id, consumed_at FROM authorization_requests");
  const loaded = await new DrizzleAuthorizationRepository(client).load(
    "organization_company_legacy",
  );

  expect(stored.rows).toEqual([
    { target_id: "organization_venue_legacy", consumed_at: null },
  ]);
  expect(loaded).toBeInstanceOf(Authorization);
  if (!(loaded instanceof Authorization)) {
    return;
  }
  expect(loaded.snapshot().requests).toEqual([
    expect.objectContaining({
      id: "request_legacy",
      venueId: "organization_venue_legacy",
      targetId: "organization_venue_legacy",
      consumedAt: null,
    }),
  ]);
});

it("given an approved discount on account A, when a mismatch is saved and the matching consume is saved again, then only that consume is stored and a second consume stays a domain error", async () => {
  const client = await openBound();
  const repository = new DrizzleAuthorizationRepository(client);
  const authorization = approvedDiscount();

  await repository.save(authorization, changed(authorization));
  const reloaded = await repository.load(TENANT_ID);

  expect(reloaded).toBeInstanceOf(Authorization);
  if (!(reloaded instanceof Authorization)) {
    return;
  }
  expect(reloaded.snapshot().requests[0]).toMatchObject({
    targetId: ACCOUNT_A,
    consumedAt: null,
  });
  expect(
    reloaded.consumeAuthorization({
      requestId: REQUEST_ID,
      permission: PERMISSION.SALE_DISCOUNT,
      targetId: ACCOUNT_B,
      value: 10,
      at: AT + 1,
    }),
  ).toBe(false);
  expect(
    reloaded.consumeAuthorization({
      requestId: REQUEST_ID,
      permission: PERMISSION.SALE_DISCOUNT,
      targetId: ACCOUNT_A,
      value: 20,
      at: AT + 1,
    }),
  ).toBe(false);

  await repository.save(reloaded, changed(reloaded));
  const unconsumed = await repository.load(TENANT_ID);

  expect(unconsumed).toBeInstanceOf(Authorization);
  if (!(unconsumed instanceof Authorization)) {
    return;
  }
  expect(unconsumed.snapshot().requests[0]?.consumedAt).toBeNull();
  expect(
    unconsumed.consumeAuthorization({
      requestId: REQUEST_ID,
      permission: PERMISSION.SALE_DISCOUNT,
      targetId: ACCOUNT_A,
      value: 10,
      at: AT + 2,
    }),
  ).toBe(true);

  await repository.save(unconsumed, changed(unconsumed));
  const consumed = await repository.load(TENANT_ID);

  expect(consumed).toBeInstanceOf(Authorization);
  if (!(consumed instanceof Authorization)) {
    return;
  }
  expect(consumed.snapshot().requests[0]).toMatchObject({
    targetId: ACCOUNT_A,
    consumedAt: AT + 2,
  });
  expect(() =>
    consumed.consumeAuthorization({
      requestId: REQUEST_ID,
      permission: PERMISSION.SALE_DISCOUNT,
      targetId: ACCOUNT_A,
      value: 10,
      at: AT + 3,
    }),
  ).toThrow(AuthorizationAlreadyConsumed);
});

it("given venue thresholds at 5, when authorization_app updates them, then the new values stay and the other tenant stays hidden", async () => {
  const client = await openBound();
  await asAuthorizationApp(client, "organization_company_a");
  await client.exec(`
    INSERT INTO authorization_venue_thresholds (
      id, tenant_id, venue_id, position
    )
    VALUES (
      'threshold_a',
      'organization_company_a',
      'organization_venue_a',
      0
    )
  `);

  const seeded = await client.query<ThresholdRow>(
    "SELECT discount, requester_authorizer_pair, failed_pin FROM authorization_venue_thresholds",
  );

  expect(seeded.rows).toEqual([
    { discount: 5, requester_authorizer_pair: 5, failed_pin: 5 },
  ]);

  await client.exec(`
    UPDATE authorization_venue_thresholds
    SET discount = 8, requester_authorizer_pair = 7, failed_pin = 3
    WHERE id = 'threshold_a'
  `);
  await asAuthorizationApp(client, "organization_company_b");
  await client.exec(`
    INSERT INTO authorization_venue_thresholds (
      id, tenant_id, venue_id, position
    )
    VALUES (
      'threshold_b',
      'organization_company_b',
      'organization_venue_b',
      0
    )
  `);
  const hidden = await client.query<{ id: string }>(
    "SELECT id FROM authorization_venue_thresholds",
  );
  await asAuthorizationApp(client, "organization_company_a");
  const updated = await client.query<ThresholdRow & { id: string }>(`
    SELECT id, discount, requester_authorizer_pair, failed_pin
    FROM authorization_venue_thresholds
  `);

  expect(hidden.rows).toEqual([{ id: "threshold_b" }]);
  expect(updated.rows).toEqual([
    {
      id: "threshold_a",
      discount: 8,
      requester_authorizer_pair: 7,
      failed_pin: 3,
    },
  ]);
});

it("given an alert, when authorization_app inserts it, then update and delete are rejected and the other tenant stays hidden", async () => {
  const client = await openBound();
  await client.exec(`
    INSERT INTO authorization_alerts (
      id, tenant_id, venue_id, kind, shift_id, occurred_at, position
    )
    VALUES
      (
        'alert_a',
        'organization_company_a',
        'organization_venue_a',
        'self-authorization',
        'shift_1',
        10,
        0
      ),
      (
        'alert_b',
        'organization_company_b',
        'organization_venue_b',
        'discounts',
        'shift_1',
        11,
        0
      )
  `);

  await expect(
    client.exec("UPDATE authorization_alerts SET kind = 'discounts'"),
  ).rejects.toThrow(/insert-only/);
  await expect(client.exec("DELETE FROM authorization_alerts")).rejects.toThrow(
    /insert-only/,
  );
  await expect(client.exec("TRUNCATE authorization_alerts")).rejects.toThrow(
    /insert-only/,
  );

  await asAuthorizationApp(client, "organization_company_a");
  await client.exec(`
    INSERT INTO authorization_alerts (
      id, tenant_id, venue_id, kind, shift_id, occurred_at, position
    )
    VALUES (
      'alert_a2',
      'organization_company_a',
      'organization_venue_a',
      'voids-after-kitchen',
      'shift_1',
      12,
      1
    )
  `);

  await expect(
    client.exec("UPDATE authorization_alerts SET kind = 'discounts'"),
  ).rejects.toThrow(/permission denied/);
  await expect(client.exec("DELETE FROM authorization_alerts")).rejects.toThrow(
    /permission denied/,
  );

  const visible = await client.query<{ id: string }>(
    "SELECT id FROM authorization_alerts ORDER BY id",
  );
  await asAuthorizationApp(client, "organization_company_b");
  const otherTenant = await client.query<{ id: string }>(
    "SELECT id FROM authorization_alerts ORDER BY id",
  );

  expect(visible.rows).toEqual([{ id: "alert_a" }, { id: "alert_a2" }]);
  expect(otherTenant.rows).toEqual([{ id: "alert_b" }]);
});

it("given 0014_authorization_binding, when its privileges are read, then alerts are insert-only, thresholds are updatable, and unrelated tables stay untouched", async () => {
  const sql = readBindingMigration().toLowerCase();
  const client = await openBound();
  const security = await client.query<RowSecurity>(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'authorization_alerts',
        'authorization_venue_thresholds'
      )
    ORDER BY c.relname
  `);
  const grants = await client.query<TableGrant>(`
    SELECT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'authorization_app'
      AND table_schema = 'public'
      AND table_name IN (
        'authorization_alerts',
        'authorization_venue_thresholds'
      )
    ORDER BY table_name, privilege_type
  `);

  expect(sql).not.toMatch(/\bpin\b/);
  expect(sql).not.toContain("pin_hash");
  expect(sql).not.toMatch(/create\s+role/);
  expect(sql).not.toMatch(/\bdrop\b/);
  expect(sql).not.toMatch(/\brename\b/);
  expect(sql).not.toMatch(
    /\b(cash_registers|audit_events|organizations|kitchen_stations)\b/,
  );
  expect(sql).toContain(
    "grant select, insert, update, delete on authorization_venue_thresholds to authorization_app",
  );
  expect(sql).toContain(
    "grant select, insert on authorization_alerts to authorization_app",
  );
  expect(sql).not.toMatch(
    /grant\s+[^;]*\b(update|delete)\b[^;]*authorization_alerts/,
  );
  expect(security.rows).toEqual([
    {
      relname: "authorization_alerts",
      relrowsecurity: true,
      relforcerowsecurity: true,
    },
    {
      relname: "authorization_venue_thresholds",
      relrowsecurity: true,
      relforcerowsecurity: true,
    },
  ]);
  expect(grants.rows).toEqual([
    { table_name: "authorization_alerts", privilege_type: "INSERT" },
    { table_name: "authorization_alerts", privilege_type: "SELECT" },
    {
      table_name: "authorization_venue_thresholds",
      privilege_type: "DELETE",
    },
    {
      table_name: "authorization_venue_thresholds",
      privilege_type: "INSERT",
    },
    {
      table_name: "authorization_venue_thresholds",
      privilege_type: "SELECT",
    },
    {
      table_name: "authorization_venue_thresholds",
      privilege_type: "UPDATE",
    },
  ]);
});

const TENANT_ID = "organization_company_1";
const OWNER_ID = "user_owner";
const SITE_ID = "organization_venue_1";
const ACCOUNT_A = "account_a";
const ACCOUNT_B = "account_b";
const REQUEST_ID = "request_discount";
const AT = 1_700_000_000_000;

interface DescribedColumn {
  table_name: string;
  column_name: string;
  column_default: string | null;
  is_nullable: string;
}

interface ThresholdRow {
  discount: number;
  requester_authorizer_pair: number;
  failed_pin: number;
}

interface RowSecurity {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

interface TableGrant {
  table_name: string;
  privilege_type: string;
}

function readBindingMigration(): string {
  return readFileSync(
    fileURLToPath(new URL("./0014_authorization_binding.sql", import.meta.url)),
    "utf8",
  );
}

async function openBase(): Promise<PGlite> {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);

  return client;
}

async function openBound(): Promise<PGlite> {
  const client = await openBase();
  await client.exec(readBindingMigration());

  return client;
}

async function asAuthorizationApp(
  client: PGlite,
  tenantId: string,
): Promise<void> {
  await client.exec("SET ROLE authorization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    tenantId,
  ]);
}

function columnsByName(
  rows: readonly DescribedColumn[],
): Record<string, { column_default: string | null; is_nullable: string }> {
  return Object.fromEntries(
    rows.map((row) => [
      `${row.table_name}.${row.column_name}`,
      {
        column_default: row.column_default,
        is_nullable: row.is_nullable,
      },
    ]),
  );
}

function approvedDiscount(): Authorization {
  const authorization = Authorization.open(TENANT_ID);

  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.requestAuthorization({
    requestId: REQUEST_ID,
    requesterId: "user_cashier",
    permission: PERMISSION.SALE_DISCOUNT,
    venueId: SITE_ID,
    targetId: ACCOUNT_A,
    value: 10,
    reason: "guest",
    expiresAt: AT + 60_000,
  });
  authorization.resolveAuthorization({
    requestId: REQUEST_ID,
    authorizerId: OWNER_ID,
    deviceId: "device_owner",
    shiftId: "shift_1",
    at: AT,
    approved: true,
    authorizerAssignmentCount: 1,
  });

  return authorization;
}

function changed(authorization: Authorization): AuthorizationChanged {
  return {
    before: Authorization.open(authorization.tenantId).snapshot(),
    after: authorization.snapshot(),
  };
}
