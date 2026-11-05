import {
  type EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  type ActiveTipRule,
  ConfigureTipRule,
  type ConfigureTipRuleCommand,
  InvalidTipRulePeriod,
  TipRuleStore,
} from "#application/configure-tip-rule/configure-tip-rule.js";
import { ConfigureTipRule as ListedOnEntryPort } from "#application/entry-port.js";
import { InvalidTipPercentage, InvalidTipRoleShare } from "#domain/tip-rule.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_manager";
const SESSION_ID = "session_manager";
const DEVICE_ID = "device_register";
const REASON = "Weekly tip split";
const WAITER = "employee_waiter";
const COOK = "employee_cook";
const ACTION = "tips.rule-changed";

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const seventyThirty: ActiveTipRule = {
  period: "week",
  mode: "percentage",
  shares: [
    { employeeId: WAITER, percent: 70 },
    { employeeId: COOK, percent: 30 },
  ],
};

const command = (
  patch: Partial<ConfigureTipRuleCommand> = {},
): ConfigureTipRuleCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: ACTOR_ID,
  authorizerId: null,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  reason: REASON,
  period: "week",
  mode: "percentage",
  shares: [
    { employeeId: WAITER, percent: 70 },
    { employeeId: COOK, percent: 30 },
  ],
  ...patch,
});

const audited = (
  after: ActiveTipRule,
  before: ActiveTipRule | null,
  authorizerId: string | null = null,
): AuditCommand => ({
  tenantId: TENANT_ID,
  actorId: ACTOR_ID,
  authorizerId,
  deviceId: DEVICE_ID,
  siteId: VENUE_ID,
  action: ACTION,
  entity: VENUE_ID,
  before,
  after,
  reason: REASON,
});

class RecordingAudit extends RecordAuditEvent {
  readonly commands: AuditCommand[] = [];

  constructor(private readonly steps: string[]) {
    super(blank, blank, blank);
  }

  override execute(entry: AuditCommand) {
    this.steps.push("audit");
    this.commands.push(entry);
    return Promise.resolve(blank);
  }
}

class MemoryTipRules extends TipRuleStore {
  private stored: ActiveTipRule | null = null;

  constructor(private readonly steps: string[]) {
    super();
  }

  override find(): Promise<ActiveTipRule | null> {
    this.steps.push("find");
    return Promise.resolve(this.stored);
  }

  override save(
    _tenantId: string,
    _venueId: string,
    rule: ActiveTipRule,
  ): Promise<void> {
    this.steps.push("save");
    this.stored = {
      period: rule.period,
      mode: rule.mode,
      shares: rule.shares.map((share) => ({ ...share })),
    };
    return Promise.resolve();
  }

  current(): ActiveTipRule | null {
    return this.stored;
  }
}

const harness = (decision: Decision = allowed()) => {
  const steps: string[] = [];
  const inputs: PermissionInput[] = [];
  const rules = new MemoryTipRules(steps);
  const permissions = {
    execute: (input: PermissionInput) => {
      steps.push("evaluate");
      inputs.push(input);
      return Promise.resolve(decision);
    },
  } as EvaluatePermission;
  const audits = new RecordingAudit(steps);

  return {
    steps,
    inputs,
    rules,
    commands: audits.commands,
    configure: new ConfigureTipRule(rules, permissions, audits),
  };
};

const expectUntouched = (scene: ReturnType<typeof harness>) => {
  expect(scene.rules.current()).toBeNull();
  expect(scene.commands).toEqual([]);
  expect(scene.steps).toEqual(["evaluate"]);
};

it("given employee percentages of 70 and 30, when an allowed caller saves the rule, then those rows are stored and audited as tips.rule-changed", async () => {
  const scene = harness();
  const replacement: ActiveTipRule = {
    period: "day",
    mode: "percentage",
    shares: [{ employeeId: WAITER, percent: 100 }],
  };

  const saved = await scene.configure.execute(command());
  const replaced = await scene.configure.execute(
    command({
      authorizerId: "user_owner",
      period: "day",
      shares: [{ employeeId: WAITER, percent: 100 }],
    }),
  );

  expect(ListedOnEntryPort).toBe(ConfigureTipRule);
  expect(saved).toEqual(seventyThirty);
  expect(scene.rules.current()).toEqual(replacement);
  expect(replaced).toEqual(replacement);
  expect(replaced).not.toBe(scene.rules.current());
  expect(scene.commands).toEqual([
    audited(seventyThirty, null),
    audited(replacement, seventyThirty, "user_owner"),
  ]);
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION, ACTION]);
  expect(scene.inputs[0]).toEqual({
    tenantId: TENANT_ID,
    sessionId: SESSION_ID,
    permission: PERMISSION.CASH_SETTLE_TIPS,
    target: { kind: "site", id: VENUE_ID, brandId: null },
    value: null,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });
  expect(scene.steps).toEqual([
    "evaluate",
    "find",
    "save",
    "audit",
    "evaluate",
    "find",
    "save",
    "audit",
  ]);
});

it.each(["equal", "hours"] as const)(
  "given %s mode, when the rule is saved, then it stores no percentage rows",
  async (mode) => {
    const scene = harness();
    const expected: ActiveTipRule = { period: "shift", mode, shares: [] };

    const saved = await scene.configure.execute(
      command({ period: "shift", mode, shares: [] }),
    );

    expect(saved).toEqual(expected);
    expect(scene.rules.current()).toEqual(expected);
    expect(scene.commands).toEqual([audited(expected, null)]);
    expect(scene.steps).toEqual(["evaluate", "find", "save", "audit"]);
  },
);

it("given percentages of 60 and 30, when the rule is saved, then it is rejected and nothing is stored", async () => {
  const scene = harness();

  await expect(
    scene.configure.execute(
      command({
        shares: [
          { employeeId: WAITER, percent: 60 },
          { employeeId: COOK, percent: 30 },
        ],
      }),
    ),
  ).rejects.toBeInstanceOf(InvalidTipPercentage);

  expectUntouched(scene);
});

it("given a non-integer percent, when the rule is saved, then it is rejected and nothing is stored", async () => {
  const scene = harness();

  await expect(
    scene.configure.execute(
      command({
        shares: [
          { employeeId: WAITER, percent: 70.5 },
          { employeeId: COOK, percent: 29.5 },
        ],
      }),
    ),
  ).rejects.toBeInstanceOf(InvalidTipPercentage);

  expectUntouched(scene);
});

it("given a role key on a percentage row, when an allowed caller saves it, then the role share is rejected", async () => {
  const scene = harness();

  await expect(
    scene.configure.execute(
      command({
        shares: [{ role: "waiter", employeeId: WAITER, percent: 100 }],
      }),
    ),
  ).rejects.toBeInstanceOf(InvalidTipRoleShare);

  expectUntouched(scene);
});

it("given the mode name by_hours, when the rule is saved, then it is rejected and nothing is stored", async () => {
  const scene = harness();

  await expect(
    scene.configure.execute(command({ mode: "by_hours", shares: [] })),
  ).rejects.toBeInstanceOf(InvalidTipPercentage);

  expectUntouched(scene);
});

it("given a period that is not shift, day, or week, when the rule is saved, then it is rejected and nothing is stored", async () => {
  const scene = harness();

  await expect(
    scene.configure.execute(command({ period: "month" })),
  ).rejects.toBeInstanceOf(InvalidTipRulePeriod);

  expectUntouched(scene);
});

it("given cash.settle-tips is denied, when the caller sends a role share, then nothing is written and nothing is audited", async () => {
  const scene = harness(denied());

  const saved = await scene.configure.execute(
    command({ shares: [{ role: "kitchen", percent: 100 }] }),
  );

  expect(saved).toBeNull();
  expectUntouched(scene);
});
