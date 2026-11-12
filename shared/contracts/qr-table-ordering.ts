import { z } from "zod";
import { venueMenu } from "#contracts/menu.js";

const qrOrderLine = z
  .object({
    productId: z.string().min(1),
    variantIds: z.array(z.string()),
    modifierIds: z.array(z.string()),
    note: z.string().optional(),
  })
  .strict();

export const submitQrOrderCommand = z
  .object({
    intentId: z.string().min(1),
    lines: z.array(qrOrderLine),
  })
  .strict();

export type SubmitQrOrderCommand = z.infer<typeof submitQrOrderCommand>;

export const qrOrderStatus = z
  .object({
    intentId: z.string(),
    status: z.enum(["none", "pending_acceptance", "applied", "rejected"]),
    checkId: z.string().nullable(),
    lineIds: z.array(z.string()),
    unavailableProductIds: z.array(z.string()),
  })
  .strict();

export type QrOrderStatus = z.infer<typeof qrOrderStatus>;

export const tableQrMenu = venueMenu
  .extend({
    tenantId: z.string(),
    venueId: z.string(),
    tableId: z.string(),
  })
  .strict();

export type TableQrMenu = z.infer<typeof tableQrMenu>;

export const qrOrderPendingApply = z
  .object({
    intentId: z.string().min(1),
    lines: z.array(qrOrderLine),
  })
  .strict();
