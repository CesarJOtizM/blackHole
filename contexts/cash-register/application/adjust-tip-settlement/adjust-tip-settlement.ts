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
  ClosedTipSettlement,
  TipParticipantAddition,
  TipParticipantEdit,
  TipParticipantRemoval,
} from "#application/settle-tips/settle-tips.js";
import {
  ParticipantChangeReasonRequired,
  type TipSettlementStore,
} from "#application/settle-tips/settle-tips.js";
import { distributeTips } from "#domain/distribute-tips.js";
import {
  MissingTipSettlement,
  type TipSettlementParticipant,
  type TipSettlementRuleSnapshot,
  TipSettlements,
} from "#domain/tip-settlement.js";

const ACTION = "tips.settlement-adjusted";
const EMPTY_SHIFT = { waiterVoidsBeforeKitchen: 0 };

export interface AdjustTipSettlementCommand {
  tenantId: string;
  venueId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  reason: string;
  settlementId: string;
  adjustsSettlementId: string;
  adds: readonly TipParticipantAddition[];
  removes: readonly TipParticipantRemoval[];
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

const assertReasons = (command: AdjustTipSettlementCommand): void => {
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

const participantsOf = (
  original: readonly TipSettlementParticipant[],
  command: AdjustTipSettlementCommand,
): TipSettlementParticipant[] => {
  const rows = new Map<string, TipSettlementParticipant>();

  for (const participant of original) {
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

const editsOf = (command: AdjustTipSettlementCommand): TipParticipantEdit[] => [
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

const ruleOf = (
  later: ActiveTipRule | null,
  original: TipSettlementRuleSnapshot,
): TipSettlementRuleSnapshot => {
  if (later === null) {
    return {
      mode: original.mode,
      shares: original.shares.map((share) => ({
        employeeId: share.employeeId,
        percent: share.percent,
      })),
    };
  }

  return {
    mode: later.mode,
    shares: later.shares.map((share) => ({
      employeeId: share.employeeId,
      percent: share.percent,
    })),
  };
};

export class AdjustTipSettlement {
  constructor(
    private readonly rules: TipRuleStore,
    private readonly settlements: TipSettlementStore,
    private readonly permissions: EvaluatePermission,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    command: AdjustTipSettlementCommand,
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
    assertSettlementId(command.adjustsSettlementId);

    const stored = await this.settlements.list(
      command.tenantId,
      command.venueId,
    );
    const book = replay(stored);
    const existing = book.settlement(command.settlementId);

    if (existing) {
      const first = stored.find((row) => row.id === existing.id);

      if (!first) {
        throw new MissingTipSettlement();
      }

      return copySettlement(first);
    }

    const original = stored.find(
      (row) => row.id === command.adjustsSettlementId,
    );

    if (!original) {
      throw new MissingTipSettlement();
    }

    const later = await this.rules.find(command.tenantId, command.venueId);
    const participants = participantsOf(original.participants, command);
    const distribution = distributeTips({
      poolCop: original.poolCop,
      mode: original.rule.mode,
      participants,
      percentages: original.rule.shares,
      removedEmployeeIds: command.removes.map((removal) => removal.userId),
    });
    const adjusted = book.adjust({
      id: command.settlementId,
      adjustsSettlementId: original.id,
      poolCop: original.poolCop,
      participants,
      shares: distribution.shares,
      residueCop: distribution.residueCop,
      rule: ruleOf(later, original.rule),
    });
    const row = copySettlement({
      id: adjusted.id,
      poolCop: adjusted.poolCop,
      methods: original.methods,
      participants: adjusted.participants,
      shares: adjusted.shares,
      residueCop: adjusted.residueCop,
      rule: adjusted.rule,
      adjustsSettlementId: adjusted.adjustsSettlementId,
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
      before: copySettlement(original),
      after: copySettlement(row),
      reason: command.reason,
    });

    return copySettlement(row);
  }
}
