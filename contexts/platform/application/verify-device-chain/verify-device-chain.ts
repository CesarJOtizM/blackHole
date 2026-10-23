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

export class VerifyDeviceChain {
  constructor(
    private readonly audits: AuditRepository,
    private readonly digests: AuditDigest,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    tenantId: string;
    deviceId: string;
  }): Promise<AuditEvent | null> {
    const stored = await this.audits.list(input.tenantId, input.deviceId);
    const finding = await inspectDevice(
      this.digests,
      input.tenantId,
      input.deviceId,
      stored,
    );

    if (!finding) {
      return null;
    }

    return appendFinding(this.audits, this.digests, this.clock, {
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      siteId: findingSite(stored, finding.sequence, ""),
      sequence: finding.sequence,
      kind: finding.kind,
      stored,
    });
  }
}
