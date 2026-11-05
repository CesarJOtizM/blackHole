const SETTLEMENT_ID_PREFIX = "settlement_";

const TIP_SETTLEMENT_MODE = {
  EQUAL: "equal",
  PERCENTAGE: "percentage",
  HOURS: "hours",
} as const;

export type TipSettlementMode =
  (typeof TIP_SETTLEMENT_MODE)[keyof typeof TIP_SETTLEMENT_MODE];

export interface TipSettlementParticipant {
  readonly userId: string;
  readonly workedMinutes: number;
}

export interface TipSettlementShare {
  readonly userId: string;
  readonly baseCop: number;
  readonly residueCop: number;
}

export interface TipSettlementPercentage {
  readonly employeeId: string;
  readonly percent: number;
}

export interface TipSettlementRuleSnapshot {
  readonly mode: TipSettlementMode;
  readonly shares: readonly TipSettlementPercentage[];
}

export interface TipSettlement {
  readonly id: string;
  readonly poolCop: number;
  readonly participants: readonly TipSettlementParticipant[];
  readonly shares: readonly TipSettlementShare[];
  readonly residueCop: number;
  readonly rule: TipSettlementRuleSnapshot;
  readonly adjustsSettlementId: string | null;
}

export interface CloseTipSettlement {
  readonly id: string;
  readonly poolCop: number;
  readonly participants: readonly TipSettlementParticipant[];
  readonly shares: readonly TipSettlementShare[];
  readonly residueCop: number;
  readonly rule: TipSettlementRuleSnapshot;
}

export interface AdjustTipSettlement {
  readonly id: string;
  readonly adjustsSettlementId: string;
  readonly poolCop: number;
  readonly participants: readonly TipSettlementParticipant[];
  readonly shares: readonly TipSettlementShare[];
  readonly residueCop: number;
  readonly rule: TipSettlementRuleSnapshot;
}

export class InvalidTipSettlementId extends Error {
  constructor() {
    super("A tip settlement identifier must use the settlement_ prefix.");
    this.name = "InvalidTipSettlementId";
  }
}

export class MissingTipSettlement extends Error {
  constructor() {
    super("An adjustment must reference a closed tip settlement.");
    this.name = "MissingTipSettlement";
  }
}

export class TipShareEditRejected extends Error {
  constructor() {
    super("A closed tip settlement share cannot be edited.");
    this.name = "TipShareEditRejected";
  }
}

function assertSettlementId(id: string): void {
  if (
    !id.startsWith(SETTLEMENT_ID_PREFIX) ||
    id.length === SETTLEMENT_ID_PREFIX.length
  ) {
    throw new InvalidTipSettlementId();
  }
}

function snapshotMode(mode: TipSettlementMode): TipSettlementMode {
  switch (mode) {
    case TIP_SETTLEMENT_MODE.EQUAL:
      return TIP_SETTLEMENT_MODE.EQUAL;
    case TIP_SETTLEMENT_MODE.PERCENTAGE:
      return TIP_SETTLEMENT_MODE.PERCENTAGE;
    case TIP_SETTLEMENT_MODE.HOURS:
      return TIP_SETTLEMENT_MODE.HOURS;
    default: {
      const unexpected: never = mode;
      throw new Error(`Unexpected tip settlement mode: ${String(unexpected)}`);
    }
  }
}

function copyParticipants(
  rows: readonly TipSettlementParticipant[],
): TipSettlementParticipant[] {
  return rows.map((row) => ({
    userId: row.userId,
    workedMinutes: row.workedMinutes,
  }));
}

function copyShares(rows: readonly TipSettlementShare[]): TipSettlementShare[] {
  return rows.map((row) => ({
    userId: row.userId,
    baseCop: row.baseCop,
    residueCop: row.residueCop,
  }));
}

function copyRule(rule: TipSettlementRuleSnapshot): TipSettlementRuleSnapshot {
  return {
    mode: snapshotMode(rule.mode),
    shares: rule.shares.map((share) => ({
      employeeId: share.employeeId,
      percent: share.percent,
    })),
  };
}

function copySettlement(row: TipSettlement): TipSettlement {
  return {
    id: row.id,
    poolCop: row.poolCop,
    participants: copyParticipants(row.participants),
    shares: copyShares(row.shares),
    residueCop: row.residueCop,
    rule: copyRule(row.rule),
    adjustsSettlementId: row.adjustsSettlementId,
  };
}

export class TipSettlements {
  private readonly recorded: TipSettlement[] = [];

  private constructor() {}

  static empty(): TipSettlements {
    return new TipSettlements();
  }

  get settlements(): readonly TipSettlement[] {
    return this.recorded.map((row) => copySettlement(row));
  }

  settlement(id: string): TipSettlement | undefined {
    const found = this.recorded.find((row) => row.id === id);

    return found ? copySettlement(found) : undefined;
  }

  close(input: CloseTipSettlement): TipSettlement {
    assertSettlementId(input.id);
    const existing = this.recorded.find((row) => row.id === input.id);

    if (existing) {
      return copySettlement(existing);
    }

    const row = copySettlement({
      id: input.id,
      poolCop: input.poolCop,
      participants: input.participants,
      shares: input.shares,
      residueCop: input.residueCop,
      rule: input.rule,
      adjustsSettlementId: null,
    });
    this.recorded.push(row);

    return copySettlement(row);
  }

  adjust(input: AdjustTipSettlement): TipSettlement {
    assertSettlementId(input.id);
    assertSettlementId(input.adjustsSettlementId);
    const existing = this.recorded.find((row) => row.id === input.id);

    if (existing) {
      return copySettlement(existing);
    }

    const original = this.recorded.find(
      (row) => row.id === input.adjustsSettlementId,
    );

    if (!original) {
      throw new MissingTipSettlement();
    }

    const row = copySettlement({
      id: input.id,
      poolCop: input.poolCop,
      participants: input.participants,
      shares: input.shares,
      residueCop: input.residueCop,
      rule: original.rule,
      adjustsSettlementId: original.id,
    });
    this.recorded.push(row);

    return copySettlement(row);
  }

  editShare(settlementId: string, userId: string, baseCop: number): never {
    assertSettlementId(settlementId);
    const stored = this.recorded.find((row) => row.id === settlementId);
    const share = stored?.shares.find((row) => row.userId === userId);

    if (share && share.baseCop !== baseCop) {
      throw new TipShareEditRejected();
    }

    throw new TipShareEditRejected();
  }
}
