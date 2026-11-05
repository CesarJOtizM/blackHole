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

const tipParticipantAddition = z
  .object({
    userId: z.string(),
    workedMinutes: z.number().int(),
    reason: z.string(),
  })
  .strict();

const tipParticipantRemoval = z
  .object({
    userId: z.string(),
    reason: z.string(),
  })
  .strict();

const tipSettlementFields = {
  reason: z.string(),
  settlementId: z.string(),
  adds: z.array(tipParticipantAddition),
  removes: z.array(tipParticipantRemoval),
  authorizationId: z.string().nullable(),
};

export const settleTipsCommand = z
  .object({
    ...tipSettlementFields,
    at: z.string(),
    from: z.string(),
    to: z.string(),
  })
  .strict();

export type SettleTipsCommand = z.infer<typeof settleTipsCommand>;

export const adjustTipSettlementCommand = z
  .object(tipSettlementFields)
  .strict();

export type AdjustTipSettlementCommand = z.infer<
  typeof adjustTipSettlementCommand
>;

const tipPaymentMethod = z.enum([
  "cash",
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
]);

const tipMethodTotal = z
  .object({
    method: tipPaymentMethod,
    amountCop: z.number().int(),
  })
  .strict();

const tipSettlementParticipant = z
  .object({
    userId: z.string(),
    workedMinutes: z.number().int(),
  })
  .strict();

const tipSettlementShare = z
  .object({
    userId: z.string(),
    baseCop: z.number().int(),
    residueCop: z.number().int(),
  })
  .strict();

const tipParticipantEdit = z
  .object({
    userId: z.string(),
    workedMinutes: z.number().int().nullable(),
    reason: z.string(),
    change: z.enum(["add", "remove"]),
  })
  .strict();

export const closedTipSettlement = z
  .object({
    id: z.string(),
    poolCop: z.number().int(),
    methods: z.array(tipMethodTotal),
    participants: z.array(tipSettlementParticipant),
    shares: z.array(tipSettlementShare),
    residueCop: z.number().int(),
    rule: z
      .object({
        mode: tipMode,
        shares: z.array(tipShare),
      })
      .strict(),
    adjustsSettlementId: z.string().nullable(),
    edits: z.array(tipParticipantEdit),
  })
  .strict();

export type ClosedTipSettlement = z.infer<typeof closedTipSettlement>;

export const printTipSettlementCommand = z
  .object({
    printerId: z.string(),
    commandId: z.string(),
    period: z.string(),
  })
  .strict();

export type PrintTipSettlementCommand = z.infer<
  typeof printTipSettlementCommand
>;

export const printedTipSettlement = z
  .object({
    settlementId: z.string(),
    status: z.enum(["printed", "backup", "queued", "failed"]),
    warning: z.string().nullable(),
  })
  .strict();

export type PrintedTipSettlement = z.infer<typeof printedTipSettlement>;
