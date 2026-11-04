const TIP_DISTRIBUTION_MODE = {
  EQUAL: "equal",
  PERCENTAGE: "percentage",
  HOURS: "hours",
} as const;

const PERCENT_TOTAL = 100;

export type TipDistributionMode =
  (typeof TIP_DISTRIBUTION_MODE)[keyof typeof TIP_DISTRIBUTION_MODE];

export interface TipDistributionParticipant {
  readonly userId: string;
  readonly workedMinutes: number;
}

export interface TipDistributionPercentage {
  readonly employeeId: string;
  readonly percent: number;
}

export interface DistributeTipsInput {
  readonly poolCop: number;
  readonly mode: TipDistributionMode;
  readonly participants: readonly TipDistributionParticipant[];
  readonly percentages: readonly TipDistributionPercentage[];
  readonly removedEmployeeIds: readonly string[];
}

export interface TipShare {
  readonly userId: string;
  readonly baseCop: number;
  readonly residueCop: number;
}

export interface TipDistribution {
  readonly shares: readonly TipShare[];
  readonly residueCop: number;
}

interface UserIdRow {
  readonly userId: string;
}

interface WeightedRecipient {
  readonly userId: string;
  readonly weight: number;
}

interface DistributionWeights {
  readonly recipients: readonly WeightedRecipient[];
  readonly totalWeight: number;
}

interface FloorShare {
  readonly userId: string;
  readonly weight: number;
  readonly baseCop: number;
  readonly remainderNumerator: number;
}

export class InvalidTipDistribution extends Error {
  constructor() {
    super("Tip distribution requires integer pesos and a known rule.");
    this.name = "InvalidTipDistribution";
  }
}

function assertPool(poolCop: number): void {
  if (!Number.isInteger(poolCop) || poolCop < 0) {
    throw new InvalidTipDistribution();
  }
}

function byUserId(left: UserIdRow, right: UserIdRow): number {
  return left.userId.localeCompare(right.userId);
}

function kept(
  recipients: readonly WeightedRecipient[],
  removedEmployeeIds: readonly string[],
): WeightedRecipient[] {
  const removed = new Set(removedEmployeeIds);

  return recipients.filter((recipient) => !removed.has(recipient.userId));
}

function weightsFor(input: DistributeTipsInput): DistributionWeights {
  if (input.mode === TIP_DISTRIBUTION_MODE.EQUAL) {
    const recipients = kept(
      input.participants.map((participant) => ({
        userId: participant.userId,
        weight: 1,
      })),
      input.removedEmployeeIds,
    );

    return { recipients, totalWeight: recipients.length };
  }

  if (input.mode === TIP_DISTRIBUTION_MODE.HOURS) {
    const recipients = kept(
      input.participants.map((participant) => ({
        userId: participant.userId,
        weight: participant.workedMinutes,
      })),
      input.removedEmployeeIds,
    );

    return {
      recipients,
      totalWeight: recipients.reduce(
        (sum, recipient) => sum + recipient.weight,
        0,
      ),
    };
  }

  return {
    recipients: kept(
      input.percentages.map((row) => ({
        userId: row.employeeId,
        weight: row.percent,
      })),
      input.removedEmployeeIds,
    ),
    totalWeight: PERCENT_TOTAL,
  };
}

function floorShare(
  poolCop: number,
  recipient: WeightedRecipient,
  totalWeight: number,
): FloorShare {
  const product = poolCop * recipient.weight;

  return {
    userId: recipient.userId,
    weight: recipient.weight,
    baseCop: Math.floor(product / totalWeight),
    remainderNumerator: product % totalWeight,
  };
}

function unpaidDistribution(
  poolCop: number,
  recipients: readonly WeightedRecipient[],
): TipDistribution {
  return {
    shares: recipients
      .map((recipient) => ({
        userId: recipient.userId,
        baseCop: 0,
        residueCop: 0,
      }))
      .sort(byUserId),
    residueCop: poolCop,
  };
}

function allocate(
  poolCop: number,
  weights: DistributionWeights,
): TipDistribution {
  const floors = weights.recipients.map((recipient) =>
    floorShare(poolCop, recipient, weights.totalWeight),
  );
  const eligible = floors.filter((row) => row.weight > 0).sort(byUserId);
  const remainderSum = eligible.reduce(
    (sum, row) => sum + row.remainderNumerator,
    0,
  );
  const extraPesos = Math.floor(remainderSum / weights.totalWeight);
  const extraUserIds = new Set(
    eligible.slice(0, extraPesos).map((row) => row.userId),
  );
  const shares = floors
    .map((row) => ({
      userId: row.userId,
      baseCop: row.baseCop,
      residueCop: extraUserIds.has(row.userId) ? 1 : 0,
    }))
    .sort(byUserId);
  const assigned = shares.reduce(
    (sum, share) => sum + share.baseCop + share.residueCop,
    0,
  );

  return { shares, residueCop: poolCop - assigned };
}

export function distributeTips(input: DistributeTipsInput): TipDistribution {
  assertPool(input.poolCop);

  if (input.poolCop === 0) {
    return { shares: [], residueCop: 0 };
  }

  const weights = weightsFor(input);

  if (weights.recipients.length === 0 || weights.totalWeight === 0) {
    return unpaidDistribution(input.poolCop, weights.recipients);
  }

  return allocate(input.poolCop, weights);
}
