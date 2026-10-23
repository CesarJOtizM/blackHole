import type { AuditEvent } from "#application/ports/audit-repository.js";
import { AuditRepository } from "#application/ports/audit-repository.js";
import { AuditSequenceConflict } from "#domain/audit.js";

const clone = (event: AuditEvent): AuditEvent =>
  JSON.parse(JSON.stringify(event)) as AuditEvent;

export class InMemoryAuditRepository extends AuditRepository {
  private readonly events: AuditEvent[] = [];

  override async append(event: AuditEvent): Promise<void> {
    const duplicate = this.events.find(
      (stored) =>
        stored.tenantId === event.tenantId &&
        stored.deviceId === event.deviceId &&
        stored.sequence === event.sequence &&
        stored.kind === event.kind,
    );

    if (duplicate) {
      if (duplicate.digest !== event.digest) {
        throw new AuditSequenceConflict();
      }

      return;
    }

    this.events.push(clone(event));
  }

  override async list(
    tenantId: string,
    deviceId: string | null,
  ): Promise<readonly AuditEvent[]> {
    return this.events
      .filter(
        (event) =>
          event.tenantId === tenantId &&
          (deviceId === null || event.deviceId === deviceId),
      )
      .map(clone);
  }
}
