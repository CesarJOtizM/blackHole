import { z } from "zod";

export const openShiftCommand = z
  .object({
    shiftId: z.string().regex(/^shift_.+/),
    openingFloatCop: z.number().int().nonnegative(),
  })
  .strict();

export type OpenShiftCommand = z.infer<typeof openShiftCommand>;

export const openedCashShift = z
  .object({
    id: z.string(),
    registerId: z.string(),
    cashierId: z.string(),
    openingFloatCop: z.number().int().nonnegative(),
    state: z.literal("open"),
  })
  .strict();

export type OpenedCashShift = z.infer<typeof openedCashShift>;

const cop = z.number().int().nonnegative();

const cardCapture = {
  terminal: z.string().min(1),
  approvalNumber: z.string().min(1),
  brand: z.string().min(1),
  last4: z.string().regex(/^\d{4}$/),
};

const cashTender = z
  .object({
    method: z.literal("cash"),
    amountCop: cop,
  })
  .strict();

const cardTender = z
  .object({
    method: z.literal("card"),
    amountCop: cop,
    ...cardCapture,
  })
  .strict();

const plainTender = z
  .object({
    method: z.enum([
      "transfer",
      "wallet",
      "voucher",
      "customer_credit",
      "corporate_credit",
    ]),
    amountCop: cop,
  })
  .strict();

const tender = z.discriminatedUnion("method", [
  cashTender,
  cardTender,
  plainTender,
]);

const cashTip = z
  .object({
    method: z.literal("cash"),
    amountCop: cop,
  })
  .strict();

const cardTip = z
  .object({
    method: z.literal("card"),
    amountCop: cop,
    ...cardCapture,
  })
  .strict();

const plainTip = z
  .object({
    method: z.enum([
      "transfer",
      "wallet",
      "voucher",
      "customer_credit",
      "corporate_credit",
    ]),
    amountCop: cop,
  })
  .strict();

const tip = z.discriminatedUnion("method", [cashTip, cardTip, plainTip]);

const chargedLine = z
  .object({
    lineId: z.string(),
    productId: z.string(),
    priceCop: cop,
    originTableId: z.string(),
    menuClass: z.string(),
  })
  .strict();

export const chargeCheckCommand = z
  .object({
    commandId: z.string().min(1),
    paymentId: z.string().regex(/^payment_.+/),
    closureId: z.string().regex(/^closure_.+/),
    tenders: z.array(tender).min(1),
    tip,
  })
  .strict();

export type ChargeCheckCommand = z.infer<typeof chargeCheckCommand>;

export const chargedCheck = z
  .object({
    id: z.string(),
    status: z.literal("queued"),
    commandId: z.string(),
    checkId: z.string(),
    tableId: z.string(),
    registerId: z.string(),
    paymentId: z.string(),
    saleCop: cop,
    changeCop: cop,
    lines: z.array(chargedLine),
    tenders: z.array(tender),
    tip,
    printed: z.literal(false).optional(),
  })
  .strict();

export type ChargedCheck = z.infer<typeof chargedCheck>;

const cashDenomination = z.union([
  z.literal(50),
  z.literal(100),
  z.literal(200),
  z.literal(500),
  z.literal(1_000),
  z.literal(2_000),
  z.literal(5_000),
  z.literal(10_000),
  z.literal(20_000),
  z.literal(50_000),
  z.literal(100_000),
]);

const denominationLine = z
  .object({
    denomination: cashDenomination,
    quantity: cop,
  })
  .strict();

const terminalReport = z
  .object({
    terminalId: z.string().min(1),
    recordedCop: cop,
    reportedCop: cop,
  })
  .strict();

export const submitCountCommand = z
  .object({
    countId: z.string().regex(/^count_.+/),
    denominations: z.array(denominationLine),
    terminals: z.array(terminalReport),
  })
  .strict();

export type SubmitCountCommand = z.infer<typeof submitCountCommand>;

export const approveVarianceCommand = z
  .object({
    justification: z.string().min(1),
    varianceCop: cop,
  })
  .strict();

export type ApproveVarianceCommand = z.infer<typeof approveVarianceCommand>;

export const partialCloseCommand = z
  .object({
    countId: z.string().regex(/^count_.+/),
  })
  .strict();

export type PartialCloseCommand = z.infer<typeof partialCloseCommand>;

export const finalCloseCommand = z
  .object({
    varianceCop: cop,
  })
  .strict();

export type FinalCloseCommand = z.infer<typeof finalCloseCommand>;

export const cashCountView = z
  .object({
    state: z.enum(["open", "counting", "closed"]),
    countedCashCop: cop.optional(),
    differenceCop: z.number().int().optional(),
    printed: z.literal(false).optional(),
  })
  .strict();

export type CashCountView = z.infer<typeof cashCountView>;
