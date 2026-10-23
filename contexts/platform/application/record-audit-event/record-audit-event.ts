import {
  appendFinding,
  findingSite,
  inspectDevice,
} from "#application/audit-chain.js";
import type { AuditDigest } from "#application/ports/audit-digest.js";
import type {
  AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import type { Clock } from "#application/ports/clock.js";
import {
  DeviceChain,
  GENESIS_PREVIOUS_HASH,
  MissingActor,
} from "#domain/audit.js";

export interface RecordAuditCommand {
  tenantId: string;
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  siteId: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export class RecordAuditEvent {
  constructor(
    private readonly audits: AuditRepository,
    private readonly digests: AuditDigest,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordAuditCommand): Promise<AuditEvent> {
    if (command.actorId.trim() === "") {
      throw new MissingActor();
    }

    const stored = await this.audits.list(command.tenantId, command.deviceId);
    const finding = await inspectDevice(
      this.digests,
      command.tenantId,
      command.deviceId,
      stored,
    );

    if (finding) {
      return appendFinding(this.audits, this.digests, this.clock, {
        tenantId: command.tenantId,
        deviceId: command.deviceId,
        siteId: findingSite(stored, finding.sequence, command.siteId),
        sequence: finding.sequence,
        kind: finding.kind,
        stored,
      });
    }

    const events = stored.filter((event) => event.kind === "event");
    const chain = DeviceChain.restore(
      command.tenantId,
      command.deviceId,
      events,
    );
    const occurredAt = this.clock.now();
    const previous = chain.links.at(-1);
    const sequence = previous ? previous.sequence + 1 : 1;
    const previousHash = previous ? previous.digest : GENESIS_PREVIOUS_HASH;
    const body = {
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.siteId,
      action: command.action,
      entity: command.entity,
      before: command.before,
      after: command.after,
      reason: command.reason,
      occurredAt,
      sequence,
      previousHash,
    };
    const link = chain.append({
      ...body,
      digest: await this.digests.digest(body),
    });

    const event: AuditEvent = {
      ...link,
      tenantId: command.tenantId,
      kind: "event",
    };

    await this.audits.append(event);

    return event;
  }
}
