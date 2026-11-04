import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";

import type { TipPeriodKind } from "#domain/tip-period.js";
import {
  InvalidTipPercentage,
  type TipPercentage,
  TipRule,
  type TipRuleMode,
} from "#domain/tip-rule.js";

const ACTION = "tips.rule-changed";
const PERIODS = ["shift", "day", "week"] as const;
const EMPTY_SHIFT = { waiterVoidsBeforeKitchen: 0 };

export class InvalidTipRulePeriod extends Error {
  constructor() {
    super("A tip rule period must be shift, day, or week.");
    this.name = "InvalidTipRulePeriod";
  }
}

export interface ActiveTipRule {
  period: TipPeriodKind;
  mode: TipRuleMode;
  shares: readonly TipPercentage[];
}

export interface ConfigureTipRuleCommand {
  tenantId: string;
  venueId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  reason: string;
  period: string;
  mode: string;
  shares: readonly unknown[];
}

export abstract class TipRuleStore {
  abstract find(
    tenantId: string,
    venueId: string,
  ): Promise<ActiveTipRule | null>;

  abstract save(
    tenantId: string,
    venueId: string,
    rule: ActiveTipRule,
  ): Promise<void>;
}

const snapshot = (rule: ActiveTipRule): ActiveTipRule => ({
  period: rule.period,
  mode: rule.mode,
  shares: rule.shares.map((share) => ({
    employeeId: share.employeeId,
    percent: share.percent,
  })),
});

const periodOf = (value: string): TipPeriodKind => {
  const found = PERIODS.find((kind) => kind === value);

  if (found === undefined) {
    throw new InvalidTipRulePeriod();
  }

  return found;
};

const ruleFrom = (mode: string, shares: readonly unknown[]): TipRule => {
  if (mode === "equal" || mode === "hours") {
    if (shares.length > 0) {
      throw new InvalidTipPercentage();
    }

    return mode === "equal" ? TipRule.equal() : TipRule.hours();
  }

  if (mode === "percentage") {
    return TipRule.percentage(shares);
  }

  throw new InvalidTipPercentage();
};

const activeRule = (command: ConfigureTipRuleCommand): ActiveTipRule => {
  const rule = ruleFrom(command.mode, command.shares);

  return snapshot({
    period: periodOf(command.period),
    mode: rule.mode,
    shares: rule.shares,
  });
};

export class ConfigureTipRule {
  constructor(
    private readonly rules: TipRuleStore,
    private readonly permissions: EvaluatePermission,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    command: ConfigureTipRuleCommand,
  ): Promise<ActiveTipRule | null> {
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

    const next = activeRule(command);
    const previous = await this.rules.find(command.tenantId, command.venueId);

    await this.rules.save(command.tenantId, command.venueId, next);
    await this.audits.execute({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.venueId,
      action: ACTION,
      entity: command.venueId,
      before: previous === null ? null : snapshot(previous),
      after: snapshot(next),
      reason: command.reason,
    });

    return snapshot(next);
  }
}
