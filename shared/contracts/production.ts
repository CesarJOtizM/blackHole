import { z } from "zod";

const preparationStandardCost = z
  .object({
    recipeId: z.string().min(1),
    standardUnitCost: z.number().int().nonnegative(),
  })
  .strict();

export const recordProductionCommand = z
  .object({
    runId: z.string().min(1),
    locationId: z.string().min(1),
    recipeId: z.string().min(1),
    expectedQuantity: z.number().int().positive(),
    actualQuantity: z.number().int().nonnegative(),
  })
  .strict();

export type RecordProductionCommand = z.infer<typeof recordProductionCommand>;

export const productionRun = z
  .object({
    runId: z.string().min(1),
    locationId: z.string().min(1),
    recipeId: z.string().min(1),
    expectedQuantity: z.number().int().positive(),
    actualQuantity: z.number().int().nonnegative(),
    variance: z.number().int().optional(),
    outputUnitCost: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export type ProductionRun = z.infer<typeof productionRun>;

export const correctProductionCommand = z
  .object({
    correctionRunId: z.string().min(1),
    authorizationId: z.string().min(1).optional(),
  })
  .strict();

export type CorrectProductionCommand = z.infer<typeof correctProductionCommand>;

export const productionCorrection = z
  .object({
    originalRunId: z.string().min(1),
    correctionRunId: z.string().min(1),
  })
  .strict();

export type ProductionCorrection = z.infer<typeof productionCorrection>;

export const configureProductionCostCommand = z
  .object({
    costRule: z.enum(["consumed_average", "standard"]),
    preparations: z.array(preparationStandardCost),
  })
  .strict();

export type ConfigureProductionCostCommand = z.infer<
  typeof configureProductionCostCommand
>;

export const productionCostPolicy = configureProductionCostCommand;

export type ProductionCostPolicy = z.infer<typeof productionCostPolicy>;
