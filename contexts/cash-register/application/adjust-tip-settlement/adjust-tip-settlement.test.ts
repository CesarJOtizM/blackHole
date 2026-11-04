import {
  type EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  AdjustTipSettlement,
  type AdjustTipSettlementCommand,
} from "#application/adjust-tip-settlement/adjust-tip-settlement.js";
import type { ActiveTipRule } from "#application/configure-tip-rule/configure-tip-rule.js";
import { TipRuleStore } from "#application/configure-tip-rule/configure-tip-rule.js";
import { AdjustTipSettlement as ListedOnEntryPort } from "#application/entry-port.js";
import {
  type ClosedTipSettlement,
  ParticipantChangeReasonRequired,
  TipSettlementStore,
} from "#application/settle-tips/settle-tips.js";
import { MissingTipSettlement } from "#domain/tip-settlement.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_manager";
const SESSION_ID = "session_manager";
const DEVICE_ID = "device_register";
const REASON = "Correct the week";
const COOK = "employee_cook";
const HOST = "employee_host";
const WAITER = "employee_waiter";
const SETTLEMENT_ID = "settlement_week";
const ADJUSTMENT_ID = "settlement_week_adjustment";
const ACTION = "tips.settlement-adjusted";

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;
const clone = <T>(value: T): T => structuredClone(value);

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const laterHours: ActiveTipRule = {
  period: "week",
  mode: "hours",
  shares: [],
};

const closedWeek = (): ClosedTipSettlement => ({
  id: SETTLEMENT_ID,
  poolCop: 90_000,
  methods: [
    { method: "cash", amountCop: 40_000 },
    { method: "card", amountCop: 50_000 },
  ],
  participants: [
    { userId: COOK, workedMinutes: 360 },
    { userId: WAITER, workedMinutes: 480 },
  ],
  shares: [
    { userId: COOK, baseCop: 45_000, residueCop: 0 },
    { userId: WAITER, baseCop: 45_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: { mode: "equal", shares: [] },
  adjustsSettlementId: null,
  edits: [],
});

const adjustedWeek = (): ClosedTipSettlement => ({
  id: ADJUSTMENT_ID,
  poolCop: 90_000,
  methods: [
    { method: "cash", amountCop: 40_000 },
    { method: "card", amountCop: 50_000 },
  ],
  participants: [
    { userId: COOK, workedMinutes: 360 },
    { userId: WAITER, workedMinutes: 480 },
    { userId: HOST, workedMinutes: 0 },
  ],
  shares: [
    { userId: COOK, baseCop: 30_000, residueCop: 0 },
    { userId: HOST, baseCop: 30_000, residueCop: 0 },
    { userId: WAITER, baseCop: 30_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: { mode: "equal", shares: [] },
  adjustsSettlementId: SETTLEMENT_ID,
  edits: [
    {
      userId: HOST,
      workedMinutes: 0,
      reason: "Called in",
      change: "add",
    },
  ],
});

const closedPercentage = (): ClosedTipSettlement => ({
  id: SETTLEMENT_ID,
  poolCop: 10_000,
  methods: [{ method: "cash", amountCop: 10_000 }],
  participants: [
    { userId: COOK, workedMinutes: 360 },
    { userId: WAITER, workedMinutes: 480 },
  ],
  shares: [
    { userId: COOK, baseCop: 4_000, residueCop: 0 },
    { userId: WAITER, baseCop: 6_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: {
    mode: "percentage",
    shares: [
      { employeeId: WAITER, percent: 60 },
      { employeeId: COOK, percent: 40 },
    ],
  },
  adjustsSettlementId: null,
  edits: [],
});

const command = (
  patch: Partial<AdjustTipSettlementCommand> = {},
): AdjustTipSettlementCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: ACTOR_ID,
  authorizerId: "user_owner",
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  reason: REASON,
  settlementId: ADJUSTMENT_ID,
  adjustsSettlementId: SETTLEMENT_ID,
  adds: [],
  removes: [],
  ...patch,
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
  constructor(
    private readonly steps: string[],
    current: ActiveTipRule | null,
  ) {
    super();
    this.current = current;
  }

  current: ActiveTipRule | null;

  override find(): Promise<ActiveTipRule | null> {
    this.steps.push("rule");
    return Promise.resolve(this.current === null ? null : clone(this.current));
  }

  override save(): Promise<void> {
    this.steps.push("save-rule");
    return Promise.resolve();
  }
}

class MemorySettlements extends TipSettlementStore {
  readonly rows: ClosedTipSettlement[];

  constructor(
    private readonly steps: string[],
    seed: readonly ClosedTipSettlement[],
  ) {
    super();
    this.rows = seed.map((row) => clone(row));
  }

  override list(): Promise<readonly ClosedTipSettlement[]> {
    this.steps.push("settlements");
    return Promise.resolve(this.rows.map((row) => clone(row)));
  }

  override append(
    _tenantId: string,
    _venueId: string,
    row: ClosedTipSettlement,
  ): Promise<void> {
    this.steps.push("append");
    this.rows.push(clone(row));
    return Promise.resolve();
  }
}

const harness = (
  decision: Decision = allowed(),
  options: {
    rule?: ActiveTipRule | null;
    closed?: readonly ClosedTipSettlement[];
  } = {},
) => {
  const steps: string[] = [];
  const inputs: PermissionInput[] = [];
  const rules = new MemoryTipRules(
    steps,
    options.rule === undefined ? laterHours : options.rule,
  );
  const settlements = new MemorySettlements(
    steps,
    options.closed ?? [closedWeek()],
  );
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
    settlements,
    commands: audits.commands,
    adjust: new AdjustTipSettlement(rules, settlements, permissions, audits),
  };
};

it("given a closed settlement and a later venue rule, when an allowed caller adds a participant, then the new row keeps adjustsSettlementId and the original rule snapshot and the closed row stays unchanged", async () => {
  const scene = harness();
  const original = scene.settlements.rows[0];

  const saved = await scene.adjust.execute(
    command({
      adds: [{ userId: HOST, workedMinutes: 0, reason: "Called in" }],
    }),
  );

  expect(ListedOnEntryPort).toBe(AdjustTipSettlement);
  expect(saved).toEqual(adjustedWeek());
  expect(saved).not.toBe(scene.settlements.rows[1]);
  expect(scene.settlements.rows).toHaveLength(2);
  expect(scene.settlements.rows[0]).toBe(original);
  expect(original).toEqual(closedWeek());
  expect(scene.rules.current).toEqual(laterHours);
  expect(saved?.rule).toEqual({ mode: "equal", shares: [] });
  expect(scene.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: "user_owner",
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: ACTION,
      entity: ADJUSTMENT_ID,
      before: closedWeek(),
      after: adjustedWeek(),
      reason: REASON,
    },
  ]);
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION]);
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
    "settlements",
    "rule",
    "append",
    "audit",
  ]);
  expect(scene.steps).not.toContain("save-rule");

  const mutable = saved?.shares[0] as { baseCop: number } | undefined;

  if (mutable) {
    mutable.baseCop = 1;
  }

  expect(scene.settlements.rows[1]).toEqual(adjustedWeek());
  expect(original).toEqual(closedWeek());
});

it("given a closed percentage settlement, when an employee is removed after the venue rule changed, then the percent stays in residueCop and the original snapshot is kept", async () => {
  const scene = harness(allowed(), {
    rule: { period: "day", mode: "equal", shares: [] },
    closed: [closedPercentage()],
  });
  const original = scene.settlements.rows[0];

  const saved = await scene.adjust.execute(
    command({ removes: [{ userId: COOK, reason: "Absent" }] }),
  );

  expect(saved?.participants).toEqual([{ userId: WAITER, workedMinutes: 480 }]);
  expect(saved?.shares).toEqual([
    { userId: WAITER, baseCop: 6_000, residueCop: 0 },
  ]);
  expect(saved?.residueCop).toBe(4_000);
  expect(saved?.poolCop).toBe(10_000);
  expect(saved?.rule).toEqual(closedPercentage().rule);
  expect(saved?.adjustsSettlementId).toBe(SETTLEMENT_ID);
  expect(saved?.edits).toEqual([
    {
      userId: COOK,
      workedMinutes: null,
      reason: "Absent",
      change: "remove",
    },
  ]);
  expect(original).toEqual(closedPercentage());
  expect(scene.settlements.rows).toHaveLength(2);
  expect(scene.rules.current).toEqual({
    period: "day",
    mode: "equal",
    shares: [],
  });
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION]);
  expect(scene.steps).not.toContain("save-rule");
});

it("given the same adjustment id, when it is submitted again after another rule change, then the first row is returned and the closed row stays unchanged", async () => {
  const scene = harness();

  const first = await scene.adjust.execute(
    command({
      adds: [{ userId: HOST, workedMinutes: 0, reason: "Called in" }],
    }),
  );
  scene.steps.splice(0, scene.steps.length);
  scene.rules.current = {
    period: "day",
    mode: "percentage",
    shares: [{ employeeId: COOK, percent: 100 }],
  };

  const second = await scene.adjust.execute(
    command({
      adds: [{ userId: HOST, workedMinutes: 0, reason: "Called in" }],
    }),
  );

  expect(second).toEqual(first);
  expect(second).toEqual(adjustedWeek());
  expect(scene.settlements.rows).toHaveLength(2);
  expect(scene.settlements.rows[0]).toEqual(closedWeek());
  expect(scene.commands).toHaveLength(1);
  expect(scene.steps).toEqual(["evaluate", "settlements"]);
});

it.each([
  ["add", { adds: [{ userId: HOST, workedMinutes: 0, reason: "" }] }],
  ["remove", { removes: [{ userId: COOK, reason: " " }] }],
] as const)(
  "given a participant %s without a reason, when adjustment is attempted, then the change is rejected and nothing is stored",
  async (_change, patch) => {
    const scene = harness();
    const original = scene.settlements.rows[0];

    await expect(scene.adjust.execute(command(patch))).rejects.toBeInstanceOf(
      ParticipantChangeReasonRequired,
    );

    expect(scene.settlements.rows).toEqual([closedWeek()]);
    expect(original).toEqual(closedWeek());
    expect(scene.commands).toEqual([]);
    expect(scene.steps).toEqual(["evaluate"]);
  },
);

it("given cash.settle-tips is denied, when the caller adjusts a settlement without a reason, then nothing is written and nothing is audited", async () => {
  const scene = harness(denied());
  const original = scene.settlements.rows[0];

  const saved = await scene.adjust.execute(
    command({ removes: [{ userId: COOK, reason: "" }] }),
  );

  expect(saved).toBeNull();
  expect(scene.settlements.rows).toEqual([closedWeek()]);
  expect(original).toEqual(closedWeek());
  expect(scene.commands).toEqual([]);
  expect(scene.steps).toEqual(["evaluate"]);
});

it("given the closed settlement is missing, when adjustment is attempted, then nothing is stored and nothing is audited", async () => {
  const scene = harness(allowed(), { closed: [] });

  await expect(scene.adjust.execute(command())).rejects.toBeInstanceOf(
    MissingTipSettlement,
  );

  expect(scene.settlements.rows).toEqual([]);
  expect(scene.commands).toEqual([]);
  expect(scene.steps).toEqual(["evaluate", "settlements"]);
});
