const TIP_RULE_MODE = {
  EQUAL: "equal",
  PERCENTAGE: "percentage",
  HOURS: "hours",
} as const;

const PERCENT_TOTAL = 100;

export type TipRuleMode = (typeof TIP_RULE_MODE)[keyof typeof TIP_RULE_MODE];

export interface TipPercentage {
  readonly employeeId: string;
  readonly percent: number;
}

export class InvalidTipPercentage extends Error {
  constructor() {
    super("Tip percentages must be integers from 0 to 100 that sum to 100.");
    this.name = "InvalidTipPercentage";
  }
}

export class InvalidTipRoleShare extends Error {
  constructor() {
    super("A tip percentage cannot use a role.");
    this.name = "InvalidTipRoleShare";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shareFrom(row: unknown): TipPercentage {
  if (!isRecord(row)) {
    throw new InvalidTipPercentage();
  }

  if ("role" in row) {
    throw new InvalidTipRoleShare();
  }

  const { employeeId, percent } = row;

  if (
    typeof employeeId !== "string" ||
    employeeId.length === 0 ||
    typeof percent !== "number" ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > PERCENT_TOTAL
  ) {
    throw new InvalidTipPercentage();
  }

  return { employeeId, percent };
}

export class TipRule {
  readonly mode: TipRuleMode;
  readonly shares: readonly TipPercentage[];

  private constructor(mode: TipRuleMode, shares: readonly TipPercentage[]) {
    this.mode = mode;
    this.shares = shares;
  }

  static equal(): TipRule {
    return new TipRule(TIP_RULE_MODE.EQUAL, []);
  }

  static hours(): TipRule {
    return new TipRule(TIP_RULE_MODE.HOURS, []);
  }

  static percentage(rows: readonly unknown[]): TipRule {
    if (!Array.isArray(rows)) {
      throw new InvalidTipPercentage();
    }

    const shares = rows.map((row) => shareFrom(row));
    const total = shares.reduce((sum, share) => sum + share.percent, 0);

    if (total !== PERCENT_TOTAL) {
      throw new InvalidTipPercentage();
    }

    return new TipRule(TIP_RULE_MODE.PERCENTAGE, shares);
  }
}
