export const AUDIT_RECORD_KIND = {
  EVENT: "event",
  ALTERED: "altered",
  DELETED: "deleted",
} as const;

export type AuditRecordKind =
  (typeof AUDIT_RECORD_KIND)[keyof typeof AUDIT_RECORD_KIND];

export interface AuditEvent {
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
  occurredAt: number;
  sequence: number;
  previousHash: string;
  digest: string;
  kind: AuditRecordKind;
}

export abstract class AuditRepository {
  abstract append(event: AuditEvent): Promise<void>;

  abstract list(
    tenantId: string,
    deviceId: string | null,
  ): Promise<readonly AuditEvent[]>;
}
