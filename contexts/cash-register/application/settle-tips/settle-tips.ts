import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import type {
  ActiveTipRule,
  TipRuleStore,
} from "#application/configure-tip-rule/configure-tip-rule.js";
import type {
  TipParticipant,
  TipParticipantSource,
} from "#application/ports/tip-participant-source.js";
import type {
  RecordedPaymentTip,
  TipMethodTotal,
  TipPool,
} from "#application/ports/tip-pool.js";
import { distributeTips } from "#domain/distribute-tips.js";
import { TipPeriod } from "#domain/tip-period.js";
import { TipRule } from "#domain/tip-rule.js";
import {
  MissingTipSettlement,
  type TipSettlementParticipant,
  type TipSettlementRuleSnapshot,
  type TipSettlementShare,
  TipSettlements,
} from "#domain/tip-settlement.js";

const ACTION = "tips.settlement-closed";
const EMPTY_SHIFT = { waiterVoidsBeforeKitchen: 0 };

export class ParticipantChangeReasonRequired extends Error {
  constructor() {
    super("Adding or removing a tip participant requires a reason.");
    this.name = "ParticipantChangeReasonRequired";
  }
}

export class MissingTipRule extends Error {
  constructor() {
    super("The venue has no tip rule.");
    this.name = "MissingTipRule";
  }
}

export interface TipParticipantEdit {
  userId: string;
  workedMinutes: number | null;
  reason: string;
  change: "add" | "remove";
}

export interface ClosedTipSettlement {
  id: string;
  poolCop: number;
  methods: readonly TipMethodTotal[];
  participants: readonly TipSettlementParticipant[];
  shares: readonly TipSettlementShare[];
  residueCop: number;
  rule: TipSettlementRuleSnapshot;
  adjustsSettlementId: string | null;
  edits: readonly TipParticipantEdit[];
}

export interface TipParticipantAddition {
  userId: string;
  workedMinutes: number;
  reason: string;
}

export interface TipParticipantRemoval {
  userId: string;
  reason: string;
}

export interface SettleTipsCommand {
  tenantId: string;
  venueId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  reason: string;
  settlementId: string;
  at: string;
  from: string;
  to: string;
  adds: readonly TipParticipantAddition[];
  removes: readonly TipParticipantRemoval[];
}

export abstract class TipSettlementStore {
  abstract list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClosedTipSettlement[]>;

  abstract append(
    tenantId: string,
    venueId: string,
    settlement: ClosedTipSettlement,
  ): Promise<void>;
}

const copySettlement = (row: ClosedTipSettlement): ClosedTipSettlement => ({
  id: row.id,
  poolCop: row.poolCop,
  methods: row.methods.map((method) => ({
    method: method.method,
    amountCop: method.amountCop,
  })),
  participants: row.participants.map((participant) => ({
    userId: participant.userId,
    workedMinutes: participant.workedMinutes,
  })),
  shares: row.shares.map((share) => ({
    userId: share.userId,
    baseCop: share.baseCop,
    residueCop: share.residueCop,
  })),
  residueCop: row.residueCop,
  rule: {
    mode: row.rule.mode,
    shares: row.rule.shares.map((share) => ({
      employeeId: share.employeeId,
      percent: share.percent,
    })),
  },
  adjustsSettlementId: row.adjustsSettlementId,
  edits: row.edits.map((edit) => ({
    userId: edit.userId,
    workedMinutes: edit.workedMinutes,
    reason: edit.reason,
    change: edit.change,
  })),
});

const blankReason = (reason: string): boolean => reason.trim().length === 0;

const assertReasons = (command: SettleTipsCommand): void => {
  const missing = [...command.adds, ...command.removes].some((change) =>
    blankReason(change.reason),
  );

  if (missing) {
    throw new ParticipantChangeReasonRequired();
  }
};

const assertSettlementId = (id: string): void => {
  TipSettlements.empty().close({
    id,
    poolCop: 0,
    participants: [],
    shares: [],
    residueCop: 0,
    rule: { mode: "equal", shares: [] },
  });
};

const replay = (rows: readonly ClosedTipSettlement[]): TipSettlements => {
  const book = TipSettlements.empty();

  for (const row of rows) {
    book.close({
      id: row.id,
      poolCop: row.poolCop,
      participants: row.participants,
      shares: row.shares,
      residueCop: row.residueCop,
      rule: row.rule,
    });
  }

  return book;
};

const periodFor = (
  rule: ActiveTipRule,
  command: SettleTipsCommand,
): TipPeriod => {
  switch (rule.period) {
    case "shift":
      return TipPeriod.shift({ from: command.from, to: command.to });
    case "day":
      return TipPeriod.day({ at: command.at });
    case "week":
      return TipPeriod.week({ at: command.at });
    default: {
      const unexpected: never = rule.period;
      throw new Error(`Unexpected tip period: ${String(unexpected)}`);
    }
  }
};

const domainRule = (active: ActiveTipRule): TipRule => {
  switch (active.mode) {
    case "equal":
      return TipRule.equal();
    case "hours":
      return TipRule.hours();
    case "percentage":
      return TipRule.percentage(active.shares);
    default: {
      const unexpected: never = active.mode;
      throw new Error(`Unexpected tip rule mode: ${String(unexpected)}`);
    }
  }
};

const poolOf = (
  rows: readonly RecordedPaymentTip[],
  period: TipPeriod,
): { poolCop: number; methods: TipMethodTotal[] } => {
  const amounts = new Map<TipMethodTotal["method"], number>();
  const order: TipMethodTotal["method"][] = [];

  for (const row of rows) {
    if (!period.contains(row.recordedAt)) {
      continue;
    }

    const method = row.tip.method;
    const current = amounts.get(method);

    if (current === undefined) {
      order.push(method);
      amounts.set(method, row.tip.amountCop);
      continue;
    }

    amounts.set(method, current + row.tip.amountCop);
  }

  const methods = order.map((method) => ({
    method,
    amountCop: amounts.get(method) ?? 0,
  }));

  return {
    poolCop: methods.reduce((sum, method) => sum + method.amountCop, 0),
    methods,
  };
};

const participantsOf = (
  sourced: readonly TipParticipant[],
  command: SettleTipsCommand,
): TipSettlementParticipant[] => {
  const rows = new Map<string, TipSettlementParticipant>();

  for (const participant of sourced) {
    rows.set(participant.userId, {
      userId: participant.userId,
      workedMinutes: participant.workedMinutes,
    });
  }

  for (const addition of command.adds) {
    rows.set(addition.userId, {
      userId: addition.userId,
      workedMinutes: addition.workedMinutes,
    });
  }

  for (const removal of command.removes) {
    rows.delete(removal.userId);
  }

  return [...rows.values()];
};

const editsOf = (command: SettleTipsCommand): TipParticipantEdit[] => [
  ...command.adds.map((addition) => ({
    userId: addition.userId,
    workedMinutes: addition.workedMinutes,
    reason: addition.reason,
    change: "add" as const,
  })),
  ...command.removes.map((removal) => ({
    userId: removal.userId,
    workedMinutes: null,
    reason: removal.reason,
    change: "remove" as const,
  })),
];

export class SettleTips {
  constructor(
    private readonly rules: TipRuleStore,
    private readonly pool: TipPool,
    private readonly participants: TipParticipantSource,
    private readonly settlements: TipSettlementStore,
    private readonly permissions: EvaluatePermission,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    command: SettleTipsCommand,
  ): Promise<ClosedTipSettlement | null> {
    const decision = await this.permissions.execute({
      tenantId: command.tenantId,
      sessionId: command.sessionId,
      permission: PERMISSION.CASH_SETTLE_TIPS,
      target: { kind: "site", id: command.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: EMPTY_SHIFT,
    });

    if (decision.outcome !== "allowed") {
      return null;
    }

    assertReasons(command);
    assertSettlementId(command.settlementId);

    const stored = await this.settlements.list(
      command.tenantId,
      command.venueId,
    );
    const existing = replay(stored).settlement(command.settlementId);

    if (existing) {
      const first = stored.find((row) => row.id === existing.id);

      if (!first) {
        throw new MissingTipSettlement();
      }

      return copySettlement(first);
    }

    const active = await this.rules.find(command.tenantId, command.venueId);

    if (active === null) {
      throw new MissingTipRule();
    }

    const period = periodFor(active, command);
    const rule = domainRule(active);
    const recorded = await this.pool.list({
      tenantId: command.tenantId,
      venueId: command.venueId,
      from: period.from,
      to: period.to,
    });
    const sourced = await this.participants.list({
      tenantId: command.tenantId,
      venueId: command.venueId,
      from: period.from,
      to: period.to,
    });
    const pool = poolOf(recorded, period);
    const participants = participantsOf(sourced, command);
    const distribution = distributeTips({
      poolCop: pool.poolCop,
      mode: rule.mode,
      participants,
      percentages: rule.shares,
      removedEmployeeIds: command.removes.map((removal) => removal.userId),
    });
    const closed = TipSettlements.empty().close({
      id: command.settlementId,
      poolCop: pool.poolCop,
      participants,
      shares: distribution.shares,
      residueCop: distribution.residueCop,
      rule: { mode: rule.mode, shares: rule.shares },
    });
    const row = copySettlement({
      id: closed.id,
      poolCop: closed.poolCop,
      methods: pool.methods,
      participants: closed.participants,
      shares: closed.shares,
      residueCop: closed.residueCop,
      rule: closed.rule,
      adjustsSettlementId: closed.adjustsSettlementId,
      edits: editsOf(command),
    });

    await this.settlements.append(command.tenantId, command.venueId, row);
    await this.audits.execute({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.venueId,
      action: ACTION,
      entity: row.id,
      before: null,
      after: copySettlement(row),
      reason: command.reason,
    });

    return copySettlement(row);
  }
}
