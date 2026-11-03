import { z } from "zod";

export const paperWidth = z.enum(["80", "58"]);

export type PaperWidth = z.infer<typeof paperWidth>;

export const reprintDocumentCommand = z.strictObject({
  document: z.string().min(1),
});

export type ReprintDocumentCommand = z.infer<typeof reprintDocumentCommand>;

export const recordedReprint = z.object({
  action: z.literal("sale.reprint"),
  actorId: z.string().min(1),
  deviceId: z.string().min(1),
  document: z.string().min(1),
  occurredAt: z.string().min(1),
});

export type RecordedReprint = z.infer<typeof recordedReprint>;
