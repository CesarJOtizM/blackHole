import { z } from "zod";

const auditRecordKind = z.enum(["event", "altered", "deleted"]);

export const auditEventRecord = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  authorizerId: z.string().nullable(),
  deviceId: z.string().min(1),
  siteId: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().min(1),
  before: z.json(),
  after: z.json(),
  reason: z.string(),
  occurredAt: z.number(),
  sequence: z.number().int(),
  previousHash: z.string().min(1),
  digest: z.string().min(1),
  kind: auditRecordKind,
});

export const auditReadResult = z.object({
  events: z.array(auditEventRecord),
  write: z.literal(false),
});

export type AuditEventRecord = z.infer<typeof auditEventRecord>;
export type AuditReadResult = z.infer<typeof auditReadResult>;
