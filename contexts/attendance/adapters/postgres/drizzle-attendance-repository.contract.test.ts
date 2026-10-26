import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleAttendancePolicyRepository } from "#adapters/postgres/drizzle-attendance-policy-repository.js";
import { DrizzleClockEntryRepository } from "#adapters/postgres/drizzle-clock-entry-repository.js";
import type { AttendancePolicy } from "#application/ports/attendance-policy-repository.js";
import { clockEntryRepositoryContract } from "#application/ports/clock-entry-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0008_attendance.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";

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

const hoursOnly = (tenantId: string): AttendancePolicy => ({
  tenantId,
  venueId: VENUE_ID,
  geofence: null,
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled: false,
  mode: "hours_only",
});

const scheduled = (tenantId: string): AttendancePolicy => ({
  tenantId,
  venueId: VENUE_ID,
  geofence: {
    latitude: 4.65,
    longitude: -74.08,
    radiusMeters: 40,
  },
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled: true,
  mode: "scheduled",
  schedule: { startsAt: "08:00", endsAt: "16:00" },
});

clockEntryRepositoryContract(async () => {
  const client = await open();

  return new DrizzleClockEntryRepository(client);
});

it("given entries for tenants A and B, when attendance_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO clock_entries (
      id, tenant_id, venue_id, user_id, device_id, kind, presence,
      occurred_at, command_id, cash_register_id, pending_review
    ) VALUES
      (
        'clock_entry_a', '${TENANT_A}', '${VENUE_ID}', 'user_a',
        'device_phone', 'clock_in', 'matched', '2026-10-26T13:00:00.000Z',
        'command_a', NULL, false
      ),
      (
        'clock_entry_b', '${TENANT_B}', '${VENUE_ID}', 'user_b',
        'device_phone', 'clock_in', 'matched', '2026-10-26T13:00:00.000Z',
        'command_b', NULL, false
      )
  `);
  await client.exec("SET ROLE attendance_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM clock_entries",
  );

  expect(selected.rows.map((row) => row.id)).toEqual(["clock_entry_a"]);
});

it("given a stored clock entry, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO clock_entries (
      id, tenant_id, venue_id, user_id, device_id, kind, presence,
      occurred_at, command_id, cash_register_id, pending_review
    ) VALUES (
      'clock_entry_owner', '${TENANT_A}', '${VENUE_ID}', 'user_a',
      'device_phone', 'clock_in', 'matched', '2026-10-26T13:00:00.000Z',
      'command_owner', NULL, false
    )
  `);

  await expect(
    client.exec("UPDATE clock_entries SET pending_review = true"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM clock_entries")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE clock_entries")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ id: string }>(
    "SELECT id FROM clock_entries",
  );
  expect(selected.rows).toEqual([{ id: "clock_entry_owner" }]);
});

it("given a policy saved twice, when the venue is read, then the latest policy returns and the other tenant stays hidden", async () => {
  const client = await open();
  const policies = new DrizzleAttendancePolicyRepository(client);

  expect(await policies.find(TENANT_A, VENUE_ID)).toBeNull();
  await policies.save(hoursOnly(TENANT_A));
  await policies.save(scheduled(TENANT_A));
  await policies.save(hoursOnly(TENANT_B));

  expect(await policies.find(TENANT_A, VENUE_ID)).toEqual(scheduled(TENANT_A));
  expect(await policies.find(TENANT_B, VENUE_ID)).toEqual(hoursOnly(TENANT_B));
  expect(
    await policies.find(TENANT_A, "organization_venue_missing"),
  ).toBeNull();
});

it("given a stored policy, when the table owner updates, deletes, or truncates it, then the trigger rejects each and the row stays", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO attendance_policies (
      tenant_id, venue_id, position, geofence_latitude, geofence_longitude,
      geofence_radius_meters, tolerance_minutes, close_time,
      operation_rule_enabled, mode, schedule_starts_at, schedule_ends_at
    ) VALUES (
      '${TENANT_A}', '${VENUE_ID}', 1, NULL, NULL, NULL, 0, '22:00',
      false, 'hours_only', NULL, NULL
    )
  `);

  await expect(
    client.exec("UPDATE attendance_policies SET tolerance_minutes = 99"),
  ).rejects.toThrow(/append-only/);
  await expect(client.exec("DELETE FROM attendance_policies")).rejects.toThrow(
    /append-only/,
  );
  await expect(client.exec("TRUNCATE attendance_policies")).rejects.toThrow(
    /append-only/,
  );

  const selected = await client.query<{ tolerance_minutes: number }>(
    "SELECT tolerance_minutes FROM attendance_policies",
  );
  expect(selected.rows).toEqual([{ tolerance_minutes: 0 }]);
});

it("given the attendance migration, when row security is read, then it is enabled and forced for attendance_app", () => {
  const sql = migration.toLowerCase();

  expect(sql).toContain("create role attendance_app");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain("grant select, insert");
  expect(sql).not.toContain("grant select, insert, update, delete");
  expect(sql).not.toMatch(/000[1-7]_/);
});
