import type { PGlite } from "@electric-sql/pglite";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  devices,
  identityChanges,
  registrationCodes,
  sessions,
  users,
} from "#adapters/postgres/schema.js";
import type { IdentityChanged } from "#application/ports/identity-repository.js";
import { IdentityRepository } from "#application/ports/identity-repository.js";
import { Identity, type Session } from "#domain/identity.js";

const DEVICE_KIND = {
  PERSONAL: "personal",
  FIXED_STATION: "fixed-station",
} as const;

const SESSION_KIND = {
  ADMINISTRATION: "administration",
  PIN: "pin",
  STATION: "station",
} as const;

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class DrizzleIdentityRepository extends IdentityRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(tenantId: string): Promise<Identity | null> {
    return this.inTenant(tenantId, async (tx) => {
      const userRows = await tx
        .select()
        .from(users)
        .orderBy(asc(users.position));
      const deviceRows = await tx
        .select()
        .from(devices)
        .orderBy(asc(devices.position));
      const codeRows = await tx
        .select()
        .from(registrationCodes)
        .orderBy(asc(registrationCodes.position));
      const sessionRows = await tx
        .select()
        .from(sessions)
        .orderBy(asc(sessions.position));

      if (
        userRows.length +
          deviceRows.length +
          codeRows.length +
          sessionRows.length ===
        0
      ) {
        return null;
      }

      return Identity.restore({
        tenantId,
        users: userRows.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          passwordHash: row.passwordHash,
          pinHash: row.pinHash,
          factorHash: row.factorHash,
          failedFactorAttempts: row.failedFactorAttempts,
          active: row.active,
        })),
        devices: deviceRows.map((row) => ({
          id: row.id,
          venueId: row.venueId,
          kind: deviceKind(row.kind),
          stationId: row.stationId,
          publicKey: row.publicKey,
          displayName: row.displayName,
          pinFailures: row.pinFailures,
          pinAttemptsLocked: row.pinAttemptsLocked,
          revoked: row.revoked,
        })),
        registrationCodes: codeRows.map((row) => ({
          id: row.id,
          venueId: row.venueId,
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          failedRedeems: row.failedRedeems,
          locked: row.locked,
          used: row.used,
        })),
        sessions: sessionRows.map((row) => ({
          sessionId: row.id,
          userId: row.userId,
          displayName: row.displayName,
          deviceId: row.deviceId,
          venueId: row.venueId,
          kind: sessionKind(row.kind),
        })),
      });
    });
  }

  override async save(
    identity: Identity,
    event: IdentityChanged,
  ): Promise<void> {
    await this.inTenant(identity.tenantId, async (tx) => {
      await deleteTree(tx, identity.tenantId);
      await insertTree(tx, identity);
      await insertEvent(tx, identity.tenantId, event);
    });
  }

  async eventsFor(tenantId: string): Promise<readonly IdentityChanged[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(identityChanges)
        .orderBy(asc(identityChanges.position));

      return rows.map((row) => ({
        before: row.beforeSnapshot,
        after: row.afterSnapshot,
      }));
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE identity_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

async function deleteTree(tx: Transaction, tenantId: string): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.tenantId, tenantId));
  await tx
    .delete(registrationCodes)
    .where(eq(registrationCodes.tenantId, tenantId));
  await tx.delete(devices).where(eq(devices.tenantId, tenantId));
  await tx.delete(users).where(eq(users.tenantId, tenantId));
}

async function insertTree(tx: Transaction, identity: Identity): Promise<void> {
  const record = identity.toRecord();
  const tenantId = record.tenantId;
  const userRows = record.users.map((user, position) => ({
    id: user.id,
    tenantId,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    pinHash: user.pinHash,
    factorHash: user.factorHash,
    failedFactorAttempts: user.failedFactorAttempts,
    active: user.active,
    position,
  }));

  if (userRows.length > 0) {
    await tx.insert(users).values(userRows);
  }

  const deviceRows = record.devices.map((device, position) => ({
    id: device.id,
    tenantId,
    venueId: device.venueId,
    kind: device.kind,
    stationId: device.stationId,
    publicKey: device.publicKey,
    displayName: device.displayName,
    pinFailures: device.pinFailures,
    pinAttemptsLocked: device.pinAttemptsLocked,
    revoked: device.revoked,
    position,
  }));

  if (deviceRows.length > 0) {
    await tx.insert(devices).values(deviceRows);
  }

  const codeRows = record.registrationCodes.map((code, position) => ({
    id: code.id,
    tenantId,
    venueId: code.venueId,
    codeHash: code.codeHash,
    expiresAt: code.expiresAt,
    failedRedeems: code.failedRedeems,
    locked: code.locked,
    used: code.used,
    position,
  }));

  if (codeRows.length > 0) {
    await tx.insert(registrationCodes).values(codeRows);
  }

  const sessionRows = record.sessions.map((session, position) => ({
    id: session.sessionId,
    tenantId,
    userId: session.userId,
    displayName: session.displayName,
    deviceId: session.deviceId,
    venueId: session.venueId,
    kind: session.kind,
    position,
  }));

  if (sessionRows.length > 0) {
    await tx.insert(sessions).values(sessionRows);
  }
}

async function insertEvent(
  tx: Transaction,
  tenantId: string,
  event: IdentityChanged,
): Promise<void> {
  const existing = await tx
    .select({ position: identityChanges.position })
    .from(identityChanges);

  await tx.insert(identityChanges).values({
    id: `${tenantId}:${existing.length}`,
    tenantId,
    position: existing.length,
    beforeSnapshot: event.before,
    afterSnapshot: event.after,
  });
}

function deviceKind(kind: string): "personal" | "fixed-station" {
  if (kind === DEVICE_KIND.PERSONAL || kind === DEVICE_KIND.FIXED_STATION) {
    return kind;
  }

  throw new Error("Stored device kind is not supported.");
}

function sessionKind(kind: string): Session["kind"] {
  if (
    kind === SESSION_KIND.ADMINISTRATION ||
    kind === SESSION_KIND.PIN ||
    kind === SESSION_KIND.STATION
  ) {
    return kind;
  }

  throw new Error("Stored session kind is not supported.");
}
