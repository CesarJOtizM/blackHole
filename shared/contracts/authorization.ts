import { z } from "zod";

const grant = z.enum(["yes", "with_limit", "with_authorization", "no"]);
const scopeKind = z.enum([
  "company",
  "brand",
  "site",
  "warehouse",
  "taxpayer",
]);
const limitCode = z.enum([
  "discountPercent",
  "voidCop",
  "compShiftCop",
  "varianceCop",
  "cashOutflowCop",
  "wasteCop",
  "countAdjustmentCop",
  "waiterVoidCount",
]);

const copyRoleCommand = z.object({
  type: z.literal("copyRole"),
  roleId: z.string(),
  sourceRoleId: z.string(),
});

const reviseRoleCommand = z.object({
  type: z.literal("reviseRole"),
  roleId: z.string(),
  grants: z.array(
    z.object({
      permission: z.string(),
      grant,
    }),
  ),
});

const assignCommand = z.object({
  type: z.literal("assign"),
  assignmentId: z.string(),
  userId: z.string(),
  roleId: z.string(),
  scopeKind,
  scopeId: z.string(),
  validFrom: z.number().nullable(),
  validUntil: z.number().nullable(),
});

const removeAssignmentCommand = z.object({
  type: z.literal("removeAssignment"),
  assignmentId: z.string(),
});

const setVenueLimitCommand = z.object({
  type: z.literal("setVenueLimit"),
  venueId: z.string(),
  roleId: z.string(),
  limit: limitCode,
  cap: z.number(),
});

const setBartenderChargeCommand = z.object({
  type: z.literal("setBartenderCharge"),
  venueId: z.string(),
  enabled: z.boolean(),
});

const enableShiftSelfAuthorizationCommand = z.object({
  type: z.literal("enableShiftSelfAuthorization"),
  id: z.string(),
  venueId: z.string(),
  shiftId: z.string(),
  enabled: z.boolean(),
});

const requestCommand = z.object({
  type: z.literal("request"),
  requestId: z.string(),
  permission: z.string(),
  venueId: z.string(),
  value: z.number().nullable(),
  reason: z.string(),
  expiresAt: z.number(),
});

const resolveCommand = z.object({
  type: z.literal("resolve"),
  requestId: z.string(),
  pin: z.string(),
  shiftId: z.string(),
  approved: z.boolean(),
});

const grantSupportCommand = z.object({
  type: z.literal("grantSupport"),
  grantId: z.string(),
  actorId: z.string(),
  expiresAt: z.number(),
});

const revokeSupportCommand = z.object({
  type: z.literal("revokeSupport"),
  grantId: z.string(),
});

export const authorizationCommand = z.discriminatedUnion("type", [
  copyRoleCommand,
  reviseRoleCommand,
  assignCommand,
  removeAssignmentCommand,
  setVenueLimitCommand,
  setBartenderChargeCommand,
  enableShiftSelfAuthorizationCommand,
  requestCommand,
  resolveCommand,
  grantSupportCommand,
  revokeSupportCommand,
]);

const snapshot = z.object({
  tenantId: z.string(),
  customRoles: z.array(z.unknown()),
  assignments: z.array(z.unknown()),
  venueLimits: z.array(z.unknown()),
  bartenderCharge: z.array(z.unknown()),
  requests: z.array(z.unknown()),
  resolutions: z.array(z.unknown()),
  supportGrants: z.array(z.unknown()),
  supportActions: z.array(z.unknown()),
  shiftFlags: z.array(z.unknown()),
  notices: z.array(z.unknown()),
});

const exceededLimit = z.object({
  code: z.string(),
  cap: z.number(),
  unit: z.enum(["percent", "cop", "count"]),
});

export const authorizationResult = z.object({
  before: snapshot,
  after: snapshot,
  outcome: z.enum(["allowed", "requires_authorization", "denied"]).nullable(),
  exceededLimit: exceededLimit.nullable(),
});

export const saleChargeCommand = z.object({
  venueId: z.string(),
  discountPercent: z.number().nullable(),
});

export const saleChargeResult = z.object({
  outcome: z.enum(["allowed", "requires_authorization"]),
  exceededLimit: exceededLimit.nullable(),
});

export type AuthorizationCommand = z.infer<typeof authorizationCommand>;
export type AuthorizationResult = z.infer<typeof authorizationResult>;
export type SaleChargeCommand = z.infer<typeof saleChargeCommand>;
export type SaleChargeResult = z.infer<typeof saleChargeResult>;
