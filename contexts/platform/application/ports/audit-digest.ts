export interface AuditDigestInput {
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
}

export abstract class AuditDigest {
  abstract digest(input: AuditDigestInput): Promise<string>;
}
