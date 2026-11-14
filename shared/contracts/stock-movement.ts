import { z } from "zod";

const MOVEMENT_TYPE = {
  PURCHASE: "purchase",
  SALE_CONSUMPTION: "sale_consumption",
  SALE_RETURN: "sale_return",
  WASTE: "waste",
  PRODUCTION_CONSUMPTION: "production_consumption",
  PRODUCTION_OUTPUT: "production_output",
  TRANSFER_OUT: "transfer_out",
  TRANSFER_IN: "transfer_in",
  COUNT_ADJUSTMENT: "count_adjustment",
} as const;

const CONSUMPTION_ROLE = {
  CONSUMPTION: "consumption",
  REVERSAL: "reversal",
} as const;

export const stockMoved = z
  .object({
    type: z.literal("StockMoved"),
    movementId: z.string().min(1),
    tenantId: z.string().min(1),
    venueId: z.string().min(1),
    locationId: z.string().min(1),
    ingredientId: z.string().min(1),
    quantity: z.number().int(),
    unitCost: z.number().int(),
    movementType: z.enum(MOVEMENT_TYPE),
    orderLineId: z.string().min(1),
    recipeVersion: z.number().int(),
    occurredAt: z.string().min(1),
    role: z.enum(CONSUMPTION_ROLE),
  })
  .strict();

export type StockMoved = z.infer<typeof stockMoved>;

export const negativeStockOpened = z
  .object({
    type: z.literal("NegativeStockOpened"),
    tenantId: z.string().min(1),
    venueId: z.string().min(1),
    locationId: z.string().min(1),
    ingredientId: z.string().min(1),
    balance: z.number().int(),
    occurredAt: z.string().min(1),
  })
  .strict();

export type NegativeStockOpened = z.infer<typeof negativeStockOpened>;
