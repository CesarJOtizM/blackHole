import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

export interface DiningAuditCommand {
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

export class PlatformDiningAudit {
  constructor(private readonly events: RecordAuditEvent) {}

  async record(command: DiningAuditCommand): Promise<void> {
    await this.events.execute(command);
  }
}
