import { EvaluateStockLevels } from "@blackhole/inventory/application/entry-port";

const silentAudit = {
  record: (): Promise<void> => Promise.resolve(),
};

export const levelsForCloud = (
  enabled: boolean,
  shortages: ConstructorParameters<typeof EvaluateStockLevels>[0] | null,
): EvaluateStockLevels | null => {
  if (!enabled || shortages === null) {
    return null;
  }

  return new EvaluateStockLevels(shortages, silentAudit);
};
