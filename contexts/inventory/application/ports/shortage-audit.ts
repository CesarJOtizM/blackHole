import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

export interface ShortageAuditCommand {
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

export abstract class ShortageAudit {
  abstract record(command: ShortageAuditCommand): Promise<void>;
}

export class PlatformShortageAudit extends ShortageAudit {
  constructor(private readonly events: RecordAuditEvent) {
    super();
  }

  override async record(command: ShortageAuditCommand): Promise<void> {
    await this.events.execute(command);
  }
}
