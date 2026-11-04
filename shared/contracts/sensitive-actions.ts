import { z } from "zod";

import { authorizationShiftTotals } from "#contracts/authorization.js";

export const sensitiveActionEnvelope = z.object({
  permission: z.string(),
  targetId: z.string(),
  authorizationId: z.string().nullable(),
  reason: z.string(),
  value: z.number(),
  shiftId: z.string(),
  shiftTotals: authorizationShiftTotals,
});

export type SensitiveActionEnvelope = z.infer<typeof sensitiveActionEnvelope>;
