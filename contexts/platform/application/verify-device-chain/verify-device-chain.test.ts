import { expect, it } from "vitest";
import { FakeClock } from "#adapters/memory/fast-identity-doubles.js";
import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import {
  AuditDigest,
  type AuditDigestInput,
} from "#application/ports/audit-digest.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import { VerifyDeviceChain } from "#application/verify-device-chain/verify-device-chain.js";

const TENANT_ID = "organization_company_1";
const DEVICE_ID = "device_phone_1";
const SITE_ID = "organization_venue_1";
const SERVER_TIME = 1_700_000_200_000;
const GENESIS = "0".repeat(64);

class NamingDigest extends AuditDigest {
  override async digest(input: AuditDigestInput): Promise<string> {
    return [
      input.previousHash,
      String(input.sequence),
      input.actorId,
      input.action,
      input.entity,
    ].join(":");
  }
}

const digests = new NamingDigest();

const event = async (
  sequence: number,
  previousHash: string,
  digest: string | null = null,
): Promise<AuditEvent> => {
  const body = {
    actorId: "user_cashier",
    authorizerId: null,
    deviceId: DEVICE_ID,
    siteId: SITE_ID,
    action: "sale.void-account",
    entity: `check_${sequence}`,
    before: { amount: sequence },
    after: { amount: 0 },
    reason: "stored",
    occurredAt: sequence,
    sequence,
    previousHash,
  };

  return {
    ...body,
    tenantId: TENANT_ID,
    digest: digest ?? (await digests.digest(body)),
    kind: "event",
  };
};

const harness = async (rows: readonly AuditEvent[]) => {
  const audits = new InMemoryAuditRepository();

  for (const row of rows) {
    await audits.append(row);
  }

  return {
    audits,
    verify: new VerifyDeviceChain(audits, digests, new FakeClock(SERVER_TIME)),
  };
};

it("given a stored row whose digest was changed, when the device is re-read, then an altered finding names that sequence", async () => {
  const row = await event(1, GENESIS, "tampered");
  const { audits, verify } = await harness([row]);

  const finding = await verify.execute({
    tenantId: TENANT_ID,
    deviceId: DEVICE_ID,
  });

  const stored = await audits.list(TENANT_ID, DEVICE_ID);
  expect(finding).toEqual(
    expect.objectContaining({
      kind: "altered",
      deviceId: DEVICE_ID,
      sequence: 1,
    }),
  );
  expect(stored.filter((item) => item.kind === "event")).toEqual([row]);
  expect(stored.filter((item) => item.kind === "altered")).toHaveLength(1);
});

it("given a stored previous hash that does not match, when the device is re-read, then an altered finding is appended", async () => {
  const row = await event(1, "ab".repeat(32));
  const { audits, verify } = await harness([row]);

  await verify.execute({ tenantId: TENANT_ID, deviceId: DEVICE_ID });

  const findings = (await audits.list(TENANT_ID, DEVICE_ID)).filter(
    (item) => item.kind === "altered",
  );
  expect(findings).toHaveLength(1);
  expect(findings[0]?.sequence).toBe(1);
});

it("given a missing sequence, when the device is re-read, then one deleted finding is kept", async () => {
  const first = await event(1, GENESIS);
  const third = await event(3, "22".repeat(32));
  const { audits, verify } = await harness([first, third]);

  await verify.execute({ tenantId: TENANT_ID, deviceId: DEVICE_ID });
  await verify.execute({ tenantId: TENANT_ID, deviceId: DEVICE_ID });

  const stored = await audits.list(TENANT_ID, DEVICE_ID);
  const findings = stored.filter((item) => item.kind === "deleted");
  expect(findings).toHaveLength(1);
  expect(findings[0]).toEqual(
    expect.objectContaining({
      deviceId: DEVICE_ID,
      sequence: 2,
      kind: "deleted",
    }),
  );
  expect(stored.filter((item) => item.kind === "event")).toHaveLength(2);
});

it("given an altered finding, when a note is stored as a new audit event, then the finding stays", async () => {
  const row = await event(1, GENESIS, "tampered");
  const { audits, verify } = await harness([row]);
  const finding = await verify.execute({
    tenantId: TENANT_ID,
    deviceId: DEVICE_ID,
  });
  const note: AuditEvent = {
    ...(await event(2, "tampered")),
    action: "note",
    reason: "reviewed",
    digest: "note-digest",
  };

  await audits.append(note);

  const stored = await audits.list(TENANT_ID, DEVICE_ID);
  expect(stored).toContainEqual(finding);
  expect(stored.filter((item) => item.action === "note")).toEqual([note]);
  expect(stored.filter((item) => item.kind === "altered")).toHaveLength(1);
});
