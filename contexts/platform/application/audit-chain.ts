import type { AuditDigest } from "#application/ports/audit-digest.js";
import type {
  AuditEvent,
  AuditRecordKind,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import type { Clock } from "#application/ports/clock.js";
import {
  type AuditLink,
  type ChainFinding,
  DeviceChain,
  GENESIS_PREVIOUS_HASH,
} from "#domain/audit.js";

const FINDING_ACTOR = "cloud-verifier";

const linkOf = (event: AuditEvent): AuditLink => ({
  actorId: event.actorId,
  authorizerId: event.authorizerId,
  deviceId: event.deviceId,
  siteId: event.siteId,
  action: event.action,
  entity: event.entity,
  before: event.before,
  after: event.after,
  reason: event.reason,
  occurredAt: event.occurredAt,
  sequence: event.sequence,
  previousHash: event.previousHash,
  digest: event.digest,
});

export const inspectDevice = async (
  digests: AuditDigest,
  tenantId: string,
  deviceId: string,
  stored: readonly AuditEvent[],
): Promise<ChainFinding | null> => {
  const chain = DeviceChain.restore(
    tenantId,
    deviceId,
    stored.filter((event) => event.kind === "event").map(linkOf),
  );
  const recomputed = new Map<number, string>();

  for (const link of chain.links) {
    recomputed.set(
      link.sequence,
      await digests.digest({
        actorId: link.actorId,
        authorizerId: link.authorizerId,
        deviceId: link.deviceId,
        siteId: link.siteId,
        action: link.action,
        entity: link.entity,
        before: link.before,
        after: link.after,
        reason: link.reason,
        occurredAt: link.occurredAt,
        sequence: link.sequence,
        previousHash: link.previousHash,
      }),
    );
  }

  return chain.inspect((link) => recomputed.get(link.sequence) ?? "");
};

export const appendFinding = async (
  audits: AuditRepository,
  digests: AuditDigest,
  clock: Clock,
  input: {
    tenantId: string;
    deviceId: string;
    siteId: string;
    sequence: number;
    kind: Extract<AuditRecordKind, "altered" | "deleted">;
    stored: readonly AuditEvent[];
  },
): Promise<AuditEvent> => {
  const existing = input.stored.find(
    (event) =>
      event.deviceId === input.deviceId &&
      event.sequence === input.sequence &&
      event.kind === input.kind,
  );

  if (existing) {
    return existing;
  }

  const occurredAt = clock.now();
  const body = {
    actorId: FINDING_ACTOR,
    authorizerId: null,
    deviceId: input.deviceId,
    siteId: input.siteId,
    action: input.kind,
    entity: `${input.deviceId}:${input.sequence}`,
    before: null,
    after: { kind: input.kind, sequence: input.sequence },
    reason:
      input.kind === "altered"
        ? "Digest or previous hash disagrees."
        : "Sequence is missing.",
    occurredAt,
    sequence: input.sequence,
    previousHash: GENESIS_PREVIOUS_HASH,
  };
  const event: AuditEvent = {
    ...body,
    tenantId: input.tenantId,
    digest: await digests.digest(body),
    kind: input.kind,
  };

  await audits.append(event);

  return event;
};

export const findingSite = (
  stored: readonly AuditEvent[],
  sequence: number,
  fallback: string,
): string =>
  stored.find((event) => event.kind === "event" && event.sequence === sequence)
    ?.siteId ??
  stored.find((event) => event.kind === "event")?.siteId ??
  fallback;
