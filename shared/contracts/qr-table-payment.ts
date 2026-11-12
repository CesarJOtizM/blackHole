import { z } from "zod";

const cop = z.number().int().nonnegative();

export const startQrPaymentCommand = z
  .object({
    tipCop: cop,
    partId: z
      .string()
      .regex(/^part_.+/)
      .optional(),
  })
  .strict();

export type StartQrPaymentCommand = z.infer<typeof startQrPaymentCommand>;

export const qrPaymentPendingApply = z
  .object({
    reference: z.string().regex(/^qrpay_.+/),
  })
  .strict();
