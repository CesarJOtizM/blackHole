export interface CreditNoteAuditCommand {
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

export abstract class CreditNoteAudit {
  abstract record(command: CreditNoteAuditCommand): Promise<void>;
}
