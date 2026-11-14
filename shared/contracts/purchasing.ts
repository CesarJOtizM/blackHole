import { z } from "zod";

const purchaseLine = z
  .object({
    ingredientId: z.string().min(1),
    purchaseQuantity: z.number().int().positive(),
    purchaseUnitCost: z.number().int().nonnegative(),
  })
  .strict();

export const receivePurchaseCommand = z
  .object({
    receiptId: z.string().min(1),
    locationId: z.string().min(1),
    purchaseOrderId: z.string().min(1).optional(),
    lines: z.array(purchaseLine).min(1),
  })
  .strict();

export type ReceivePurchaseCommand = z.infer<typeof receivePurchaseCommand>;

const purchaseReceiptLine = z
  .object({
    ingredientId: z.string().min(1),
    purchaseQuantity: z.number().int().positive(),
    purchaseUnitCost: z.number().int().nonnegative(),
    factor: z.number().int().positive(),
    quantity: z.number().int().positive(),
    unitCost: z.number().int().nonnegative(),
    averageCost: z.number().int().nonnegative().optional(),
  })
  .strict();

export const purchaseReceipt = z
  .object({
    receiptId: z.string().min(1),
    locationId: z.string().min(1),
    purchaseOrderId: z.string().min(1).nullable(),
    lines: z.array(purchaseReceiptLine).min(1),
  })
  .strict();

export type PurchaseReceipt = z.infer<typeof purchaseReceipt>;
