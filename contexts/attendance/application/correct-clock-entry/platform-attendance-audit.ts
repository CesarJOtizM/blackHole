import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import {
  AttendanceAudit,
  type AttendanceAuditCommand,
} from "#application/ports/attendance-audit.js";

export class PlatformAttendanceAudit extends AttendanceAudit {
  constructor(private readonly events: RecordAuditEvent) {
    super();
  }

  override async record(command: AttendanceAuditCommand): Promise<void> {
    await this.events.execute({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.siteId,
      action: command.action,
      entity: command.entity,
      before: command.before,
      after: command.after,
      reason: command.reason,
    });
  }
}
