import { expect, it } from "vitest";
import { FakeClock } from "#adapters/memory/fast-identity-doubles.js";
import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import {
  AuditDigest,
  type AuditDigestInput,
} from "#application/ports/audit-digest.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import { RecordAuditEvent } from "#application/record-audit-event/record-audit-event.js";
import { MissingActor } from "#domain/audit.js";

const TENANT_ID = "organization_company_1";
const DEVICE_ID = "device_phone_1";
const SITE_ID = "organization_venue_1";
const SERVER_TIME = 1_700_000_100_000;
const GENESIS = "0".repeat(64);

class NamingDigest extends AuditDigest {
  override async digest(input: AuditDigestInput): Promise<string> {
    return [
      input.previousHash,
      String(input.sequence),
      input.actorId,
      input.action,
      input.entity,
      input.deviceId,
      String(input.occurredAt),
    ].join(":");
  }
}

const command = {
  tenantId: TENANT_ID,
  actorId: "user_cashier",
  authorizerId: "user_supervisor" as string | null,
  deviceId: DEVICE_ID,
  siteId: SITE_ID,
  action: "sale.void-account",
  entity: "check_1",
  before: { amount: 20_000 },
  after: { amount: 0 },
  reason: "customer left",
};

const brokenTail = (): AuditEvent => ({
  tenantId: TENANT_ID,
  actorId: "user_cashier",
  authorizerId: null,
  deviceId: DEVICE_ID,
  siteId: SITE_ID,
  action: "sale.void-account",
  entity: "check_1",
  before: { amount: 20_000 },
  after: { amount: 0 },
  reason: "stored",
  occurredAt: 1,
  sequence: 1,
  previousHash: GENESIS,
  digest: "tampered",
  kind: "event",
});

const harness = () => {
  const audits = new InMemoryAuditRepository();
  const record = new RecordAuditEvent(
    audits,
    new NamingDigest(),
    new FakeClock(SERVER_TIME),
  );

  return { audits, record };
};

it("given a supervisor authorizes a void, when the event is recorded, then it stores requester, authorizer, value, reason, device and the server time", async () => {
  const { audits, record } = harness();

  await record.execute(command);

  const stored = await audits.list(TENANT_ID, DEVICE_ID);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toEqual(
    expect.objectContaining({
      actorId: "user_cashier",
      authorizerId: "user_supervisor",
      deviceId: DEVICE_ID,
      reason: "customer left",
      before: { amount: 20_000 },
      after: { amount: 0 },
      occurredAt: SERVER_TIME,
      sequence: 1,
      previousHash: GENESIS,
      kind: "event",
    }),
  );
  expect(stored[0]?.digest).toContain(GENESIS);
});

it("given an event without an actor, when it is recorded, then it is rejected and nothing is stored", async () => {
  const { audits, record } = harness();

  const recordMissing = record.execute({ ...command, actorId: " " });

  await expect(recordMissing).rejects.toThrow(MissingActor);
  expect(await audits.list(TENANT_ID, DEVICE_ID)).toEqual([]);
});

it("given a tail whose digest was altered, when another event is recorded, then a finding is appended and the chain is not extended", async () => {
  const { audits, record } = harness();
  await audits.append(brokenTail());

  await record.execute(command);

  const stored = await audits.list(TENANT_ID, DEVICE_ID);
  const events = stored.filter((item) => item.kind === "event");
  const findings = stored.filter((item) => item.kind === "altered");
  expect(events).toHaveLength(1);
  expect(events[0]?.digest).toBe("tampered");
  expect(findings).toHaveLength(1);
  expect(findings[0]).toEqual(
    expect.objectContaining({
      deviceId: DEVICE_ID,
      sequence: 1,
      kind: "altered",
      occurredAt: SERVER_TIME,
    }),
  );
});
