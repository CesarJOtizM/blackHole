import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { DrizzleIdentityRepository } from "#adapters/postgres/drizzle-identity-repository.js";
import { identityRepositoryContract } from "#application/ports/identity-repository.contract.js";
import { Identity, PinRejected } from "#domain/identity.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0003_identity.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];
const ISSUED_AT = 1_700_000_000_000;

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

identityRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);

  return new DrizzleIdentityRepository(client);
});

it("given identities A and B, when identity_app selects devices without a tenant filter, then only the current tenant returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(`
    INSERT INTO devices (
      id,
      tenant_id,
      venue_id,
      kind,
      station_id,
      public_key,
      display_name,
      pin_failures,
      pin_attempts_locked,
      revoked,
      position
    )
    VALUES
      (
        'device_a',
        'tenant_a',
        'venue_a',
        'personal',
        NULL,
        'device-public-key',
        '',
        0,
        false,
        false,
        0
      ),
      (
        'device_b',
        'tenant_b',
        'venue_b',
        'personal',
        NULL,
        'device-public-key',
        '',
        0,
        false,
        false,
        0
      )
  `);
  await client.exec("SET ROLE identity_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "tenant_a",
  ]);

  const selected = await client.query<{ id: string }>("SELECT id FROM devices");

  expect(selected.rows.map((row) => row.id)).toEqual(["device_a"]);
});

it("given a failed PIN attempt, when the identity is saved and loaded, then pinFailures reloads and the real PIN still matches", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);
  const repository = new DrizzleIdentityRepository(client);
  const identity = Identity.open("tenant_pin");

  identity.registerUser({
    id: "user_pin",
    displayName: "Cashier",
    passwordHash: "password-hash-secret",
    pinHash: "pin-hash-secret",
  });
  identity.issueRegistrationCode({
    id: "registration_pin",
    venueId: "venue_pin",
    codeHash: "registration-code-hash-secret",
    now: ISSUED_AT,
  });
  identity.registerDevice({
    registrationId: "registration_pin",
    codeHash: "registration-code-hash-secret",
    deviceId: "device_pin",
    userId: "user_pin",
    venueId: "venue_pin",
    publicKey: "device-public-key",
    now: ISSUED_AT,
  });

  const rejectWrongPin = () => {
    identity.startPinSession({
      userId: "user_pin",
      deviceId: "device_pin",
      pinHash: "wrong-pin-hash",
      sessionId: "session_wrong",
    });
  };

  expect(rejectWrongPin).toThrow(PinRejected);

  const snapshot = identity.snapshot();
  await repository.save(identity, { before: snapshot, after: snapshot });

  const loaded = await repository.load(identity.tenantId);

  expect(loaded).toBeInstanceOf(Identity);
  expect(loaded?.snapshot().devices[0]?.pinFailures).toBe(1);
  expect(JSON.stringify(loaded?.snapshot())).not.toContain("pin-hash-secret");
  expect(JSON.stringify(loaded?.snapshot())).not.toContain(
    "password-hash-secret",
  );

  const session = loaded?.startPinSession({
    userId: "user_pin",
    deviceId: "device_pin",
    pinHash: "pin-hash-secret",
    sessionId: "session_pin",
  });

  expect(session?.kind).toBe("pin");
  expect(loaded?.snapshot().devices[0]?.pinFailures).toBe(0);
});
