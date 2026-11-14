export const SHORTAGE_KIND = {
  LEVEL: "level",
  COVERAGE: "coverage",
  DISH: "dish",
} as const;

export type ShortageKind = (typeof SHORTAGE_KIND)[keyof typeof SHORTAGE_KIND];

export const LEVEL_SEVERITY = {
  YELLOW: "yellow",
  RED: "red",
  CRITICAL: "critical",
} as const;

export type LevelSeverity =
  (typeof LEVEL_SEVERITY)[keyof typeof LEVEL_SEVERITY];

export const LEVEL_ACTION = {
  NONE: "none",
  OPEN: "open",
  RAISE: "raise",
  HOLD: "hold",
  RESOLVE: "resolve",
} as const;

export const ESCALATION_CLOCK = {
  RED: "red",
} as const;

export type EscalationClock =
  (typeof ESCALATION_CLOCK)[keyof typeof ESCALATION_CLOCK];

const LEVEL_SEVERITIES: ReadonlySet<string> = new Set(
  Object.values(LEVEL_SEVERITY),
);

const SEVERITY_RANK: Record<LevelSeverity, number> = {
  [LEVEL_SEVERITY.YELLOW]: 1,
  [LEVEL_SEVERITY.RED]: 2,
  [LEVEL_SEVERITY.CRITICAL]: 3,
};

export class InvalidStockLevels extends Error {
  constructor() {
    super(
      "Stock levels must be whole scaled units with maximum ≥ reorder point ≥ minimum ≥ 0.",
    );
    this.name = "InvalidStockLevels";
  }
}

export interface StockLevels {
  maximum: number;
  reorderPoint: number;
  minimum: number;
}

export type LevelEvaluation =
  | { readonly action: typeof LEVEL_ACTION.NONE }
  | {
      readonly action: typeof LEVEL_ACTION.OPEN;
      readonly severity: LevelSeverity;
      readonly soldOut: boolean;
    }
  | {
      readonly action: typeof LEVEL_ACTION.RAISE;
      readonly severity: LevelSeverity;
      readonly soldOut: boolean;
    }
  | { readonly action: typeof LEVEL_ACTION.HOLD }
  | { readonly action: typeof LEVEL_ACTION.RESOLVE };

interface EvaluateLevel {
  onHand: number;
  levels: StockLevels;
  openSeverity?: LevelSeverity;
}

interface RestockQuantity {
  maximum: number;
  onHand: number;
  purchaseUnit: number;
}

const wholeScaled = (value: number): boolean => Number.isInteger(value);

export function defineStockLevels(input: StockLevels): StockLevels {
  if (
    !wholeScaled(input.maximum) ||
    !wholeScaled(input.reorderPoint) ||
    !wholeScaled(input.minimum) ||
    input.minimum < 0 ||
    input.reorderPoint < input.minimum ||
    input.maximum < input.reorderPoint
  ) {
    throw new InvalidStockLevels();
  }

  return {
    maximum: input.maximum,
    reorderPoint: input.reorderPoint,
    minimum: input.minimum,
  };
}

export function soldOut(onHand: number): boolean {
  return onHand <= 0;
}

export function evaluateLevel(input: EvaluateLevel): LevelEvaluation {
  const levels = defineStockLevels(input.levels);

  if (!wholeScaled(input.onHand)) {
    throw new InvalidStockLevels();
  }

  if (
    input.openSeverity !== undefined &&
    !LEVEL_SEVERITIES.has(input.openSeverity)
  ) {
    throw new InvalidStockLevels();
  }

  const severity = severityAt(input.onHand, levels);
  const out = soldOut(input.onHand);

  if (input.openSeverity === undefined) {
    if (severity === undefined) {
      return { action: LEVEL_ACTION.NONE };
    }

    return { action: LEVEL_ACTION.OPEN, severity, soldOut: out };
  }

  if (severity === undefined) {
    return { action: LEVEL_ACTION.RESOLVE };
  }

  if (SEVERITY_RANK[severity] > SEVERITY_RANK[input.openSeverity]) {
    return { action: LEVEL_ACTION.RAISE, severity, soldOut: out };
  }

  return { action: LEVEL_ACTION.HOLD };
}

export function roundUpRestock(input: RestockQuantity): number {
  if (
    !wholeScaled(input.maximum) ||
    !wholeScaled(input.onHand) ||
    !wholeScaled(input.purchaseUnit) ||
    input.purchaseUnit <= 0
  ) {
    throw new InvalidStockLevels();
  }

  const shortfall = input.maximum - input.onHand;

  if (shortfall <= 0) {
    return 0;
  }

  const units = Math.floor(
    (shortfall + input.purchaseUnit - 1) / input.purchaseUnit,
  );

  return units * input.purchaseUnit;
}

export function escalationClock(
  kind: ShortageKind,
  severity?: LevelSeverity,
): EscalationClock | undefined {
  if (kind !== SHORTAGE_KIND.LEVEL) {
    return undefined;
  }

  if (severity !== LEVEL_SEVERITY.RED && severity !== LEVEL_SEVERITY.CRITICAL) {
    return undefined;
  }

  return ESCALATION_CLOCK.RED;
}

function severityAt(
  onHand: number,
  levels: StockLevels,
): LevelSeverity | undefined {
  if (soldOut(onHand)) {
    return LEVEL_SEVERITY.CRITICAL;
  }

  if (onHand <= levels.minimum) {
    return LEVEL_SEVERITY.RED;
  }

  if (onHand <= levels.reorderPoint) {
    return LEVEL_SEVERITY.YELLOW;
  }

  return undefined;
}
