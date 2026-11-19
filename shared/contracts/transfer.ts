import { z } from "zod";

const transferLine = z
  .object({
    ingredientId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict();

export const requestTransferCommand = z
  .object({
    transferId: z.string().min(1),
    destinationLocationId: z.string().min(1),
    originLocationId: z.string().min(1),
    lines: z.array(transferLine).min(1),
  })
  .strict();

export type RequestTransferCommand = z.infer<typeof requestTransferCommand>;

export const dispatchTransferCommand = z
  .object({
    actorId: z.string().min(1),
    deviceId: z.string().min(1),
  })
  .strict();

export type DispatchTransferCommand = z.infer<typeof dispatchTransferCommand>;

const receiptLine = z
  .object({
    ingredientId: z.string().min(1),
    receivedQuantity: z.number().int().nonnegative(),
  })
  .strict();

export const receiveTransferCommand = z
  .object({
    lines: z.array(receiptLine).min(1),
    authorizerId: z.string().min(1).optional(),
  })
  .strict();

export type ReceiveTransferCommand = z.infer<typeof receiveTransferCommand>;

export const stockLevelsCommand = z
  .object({
    locationId: z.string().min(1),
    ingredientId: z.string().min(1),
    minimum: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
  })
  .strict()
  .refine((level) => level.maximum >= level.minimum);

export type StockLevelsCommand = z.infer<typeof stockLevelsCommand>;

const recordedLine = z
  .object({
    ingredientId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitCost: z.number().int().nonnegative().optional(),
    receivedQuantity: z.number().int().nonnegative().optional(),
    shortfall: z.number().int().nonnegative().optional(),
  })
  .strict();

export const recordedTransfer = z
  .object({
    transferId: z.string().min(1),
    originLocationId: z.string().min(1),
    destinationLocationId: z.string().min(1),
    status: z.enum([
      "requested",
      "in_transit",
      "received",
      "received_with_differences",
    ]),
    lines: z.array(recordedLine).min(1),
  })
  .strict();

export type RecordedTransfer = z.infer<typeof recordedTransfer>;
