import { z } from "zod";

const tipPeriod = z.enum(["shift", "day", "week"]);
const tipMode = z.enum(["equal", "percentage", "hours"]);

const tipShare = z
  .object({
    employeeId: z.string(),
    percent: z.number().int(),
  })
  .strict();

export const configureTipRuleCommand = z
  .object({
    reason: z.string(),
    period: tipPeriod,
    mode: tipMode,
    shares: z.array(tipShare),
    authorizationId: z.string().nullable(),
  })
  .strict();

export type ConfigureTipRuleCommand = z.infer<typeof configureTipRuleCommand>;

export const configuredTipRule = z
  .object({
    period: tipPeriod,
    mode: tipMode,
    shares: z.array(tipShare),
  })
  .strict();

export type ConfiguredTipRule = z.infer<typeof configuredTipRule>;
