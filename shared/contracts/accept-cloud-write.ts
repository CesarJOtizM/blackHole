import { z } from "zod";

export const acceptCloudWriteCommand = z.object({
  writeId: z.uuid(),
  generation: z.int().positive(),
});

export type AcceptCloudWriteCommand = z.infer<typeof acceptCloudWriteCommand>;

export const acceptedCloudWrite = z.object({
  venueId: z.string(),
  writeId: z.uuid(),
  mode: z.literal("cloud"),
  operationOwner: z.literal("cloud"),
  generation: z.int().positive(),
});

export type AcceptedCloudWrite = z.infer<typeof acceptedCloudWrite>;
