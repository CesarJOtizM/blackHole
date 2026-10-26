export interface AttendanceAuditCommand {
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

export abstract class AttendanceAudit {
  abstract record(command: AttendanceAuditCommand): Promise<void>;
}
