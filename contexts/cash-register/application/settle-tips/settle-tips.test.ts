import {
  type EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import type { ActiveTipRule } from "#application/configure-tip-rule/configure-tip-rule.js";
import { TipRuleStore } from "#application/configure-tip-rule/configure-tip-rule.js";
import { SettleTips as ListedOnEntryPort } from "#application/entry-port.js";
import { TipParticipantSource } from "#application/ports/tip-participant-source.js";
import {
  type RecordedPaymentTip,
  TipPool,
  type TipPoolQuery,
} from "#application/ports/tip-pool.js";
import {
  type ClosedTipSettlement,
  MissingTipRule,
  ParticipantChangeReasonRequired,
  SettleTips,
  type SettleTipsCommand,
  TipSettlementStore,
} from "#application/settle-tips/settle-tips.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_manager";
const SESSION_ID = "session_manager";
const DEVICE_ID = "device_register";
const REASON = "Close the day";
const COOK = "employee_cook";
const WAITER = "employee_waiter";
const SETTLEMENT_ID = "settlement_day_2026_03_04";
const ACTION = "tips.settlement-closed";
const AT = "2026-03-04T15:00:00.000Z";
const DAY_FROM = "2026-03-04T05:00:00.000Z";
const DAY_TO = "2026-03-05T05:00:00.000Z";
const INSIDE_CASH = "2026-03-04T18:00:00.000Z";
const INSIDE_CARD = "2026-03-04T20:00:00.000Z";
const OUTSIDE = "2026-03-05T05:00:00.000Z";

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;
const clone = <T>(value: T): T => structuredClone(value);

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const dayEqual: ActiveTipRule = {
  period: "day",
  mode: "equal",
  shares: [],
};

const people = [
  { userId: COOK, workedMinutes: 360 },
  { userId: WAITER, workedMinutes: 480 },
];

const cardTip = {
  method: "card" as const,
  amountCop: 30_000,
  terminal: "terminal_1",
  approvalNumber: "approval_1",
  brand: "visa",
  last4: "4242",
};

const dayTips = (): RecordedPaymentTip[] => [
  {
    recordedAt: OUTSIDE,
    tip: { method: "cash", amountCop: 40_000 },
    saleCop: 10_000,
    taxCop: 1_900,
  },
  {
    recordedAt: INSIDE_CASH,
    tip: { method: "cash", amountCop: 20_000 },
    saleCop: 80_000,
    taxCop: 15_200,
  },
  {
    recordedAt: INSIDE_CARD,
    tip: cardTip,
    saleCop: 120_000,
    taxCop: 22_800,
  },
];

const windowQuery = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  from: DAY_FROM,
  to: DAY_TO,
};

const command = (
  patch: Partial<SettleTipsCommand> = {},
): SettleTipsCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: ACTOR_ID,
  authorizerId: "user_owner",
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  reason: REASON,
  settlementId: SETTLEMENT_ID,
  at: AT,
  from: "",
  to: "",
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
    private readonly stored: ActiveTipRule | null,
  ) {
    super();
  }

  override find(): Promise<ActiveTipRule | null> {
    this.steps.push("rule");
    return Promise.resolve(this.stored === null ? null : clone(this.stored));
  }

  override save(): Promise<void> {
    this.steps.push("save-rule");
    return Promise.resolve();
  }
}

class MemoryTipPool extends TipPool {
  readonly queries: TipPoolQuery[] = [];

  constructor(
    private readonly steps: string[],
    readonly rows: RecordedPaymentTip[],
  ) {
    super();
  }

  override list(query: TipPoolQuery): Promise<readonly RecordedPaymentTip[]> {
    this.steps.push("pool");
    this.queries.push(query);
    return Promise.resolve(this.rows.map((row) => clone(row)));
  }
}

class MemoryParticipants extends TipParticipantSource {
  readonly queries: TipPoolQuery[] = [];

  constructor(
    private readonly steps: string[],
    private readonly rows: { userId: string; workedMinutes: number }[],
  ) {
    super();
  }

  override list(query: TipPoolQuery) {
    this.steps.push("participants");
    this.queries.push(query);
    return Promise.resolve(this.rows.map((row) => ({ ...row })));
  }
}

class MemorySettlements extends TipSettlementStore {
  readonly rows: ClosedTipSettlement[] = [];

  constructor(private readonly steps: string[]) {
    super();
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
    tips?: RecordedPaymentTip[];
    participants?: { userId: string; workedMinutes: number }[];
  } = {},
) => {
  const steps: string[] = [];
  const inputs: PermissionInput[] = [];
  const tips = options.tips ?? dayTips();
  const pool = new MemoryTipPool(steps, tips);
  const participants = new MemoryParticipants(
    steps,
    options.participants ?? people,
  );
  const settlements = new MemorySettlements(steps);
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
    tips,
    pool,
    participants,
    settlements,
    commands: audits.commands,
    settle: new SettleTips(
      new MemoryTipRules(
        steps,
        options.rule === undefined ? dayEqual : options.rule,
      ),
      pool,
      participants,
      settlements,
      permissions,
      audits,
    ),
  };
};

const closedDay = (): ClosedTipSettlement => ({
  id: SETTLEMENT_ID,
  poolCop: 50_000,
  methods: [
    { method: "cash", amountCop: 20_000 },
    { method: "card", amountCop: 30_000 },
  ],
  participants: people.map((person) => ({ ...person })),
  shares: [
    { userId: COOK, baseCop: 25_000, residueCop: 0 },
    { userId: WAITER, baseCop: 25_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: { mode: "equal", shares: [] },
  adjustsSettlementId: null,
  edits: [],
});

it("given tips of 20000 cash and 30000 card in a day, when an allowed caller settles, then the pool is 50000 by method and sale and tax are left out", async () => {
  const scene = harness();

  const saved = await scene.settle.execute(command());
  const stored = scene.settlements.rows[0];

  expect(ListedOnEntryPort).toBe(SettleTips);
  expect(saved).toEqual(closedDay());
  expect(stored).toEqual(saved);
  expect(saved).not.toBe(stored);
  expect(scene.pool.queries).toEqual([windowQuery]);
  expect(scene.participants.queries).toEqual([windowQuery]);
  expect(scene.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: "user_owner",
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: ACTION,
      entity: SETTLEMENT_ID,
      before: null,
      after: closedDay(),
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
    "pool",
    "participants",
    "append",
    "audit",
  ]);
  expect(JSON.stringify(saved)).not.toContain("80000");
  expect(JSON.stringify(saved)).not.toContain("15200");

  const mutable = saved?.shares[0] as { baseCop: number } | undefined;

  if (mutable) {
    mutable.baseCop = 1;
  }

  expect(scene.settlements.rows[0]).toEqual(closedDay());
});

it("given no tips in the period, when settlement is attempted, then it closes with no shares", async () => {
  const scene = harness(allowed(), { tips: [] });

  const saved = await scene.settle.execute(command());

  expect(saved).toEqual({
    ...closedDay(),
    poolCop: 0,
    methods: [],
    shares: [],
    residueCop: 0,
  });
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION]);
  expect(scene.steps).toEqual([
    "evaluate",
    "settlements",
    "rule",
    "pool",
    "participants",
    "append",
    "audit",
  ]);
});

it.each([
  ["add", { adds: [{ userId: COOK, workedMinutes: 0, reason: "" }] }],
  ["remove", { removes: [{ userId: COOK, reason: " " }] }],
] as const)(
  "given a participant %s without a reason, when settlement is attempted, then the change is rejected and nothing is stored",
  async (_change, patch) => {
    const scene = harness();

    await expect(scene.settle.execute(command(patch))).rejects.toBeInstanceOf(
      ParticipantChangeReasonRequired,
    );

    expect(scene.settlements.rows).toEqual([]);
    expect(scene.commands).toEqual([]);
    expect(scene.steps).toEqual(["evaluate"]);
  },
);

it("given an added participant with a reason, when settlement closes, then that participant is included and the reason is stored", async () => {
  const scene = harness(allowed(), {
    tips: [
      {
        recordedAt: INSIDE_CASH,
        tip: { method: "cash", amountCop: 10_000 },
        saleCop: 40_000,
        taxCop: 7_600,
      },
    ],
    participants: [{ userId: WAITER, workedMinutes: 480 }],
  });

  const saved = await scene.settle.execute(
    command({
      adds: [{ userId: COOK, workedMinutes: 0, reason: "Called in" }],
    }),
  );

  expect(saved?.participants).toEqual([
    { userId: WAITER, workedMinutes: 480 },
    { userId: COOK, workedMinutes: 0 },
  ]);
  expect(saved?.shares).toEqual([
    { userId: COOK, baseCop: 5_000, residueCop: 0 },
    { userId: WAITER, baseCop: 5_000, residueCop: 0 },
  ]);
  expect(saved?.edits).toEqual([
    {
      userId: COOK,
      workedMinutes: 0,
      reason: "Called in",
      change: "add",
    },
  ]);
  expect(saved?.poolCop).toBe(10_000);
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION]);
});

it("given a removed employee with a reason, when the percentage pool is settled, then that employee is excluded and the percent stays in residueCop", async () => {
  const scene = harness(allowed(), {
    rule: {
      period: "day",
      mode: "percentage",
      shares: [
        { employeeId: WAITER, percent: 60 },
        { employeeId: COOK, percent: 40 },
      ],
    },
    tips: [
      {
        recordedAt: INSIDE_CASH,
        tip: { method: "cash", amountCop: 10_000 },
        saleCop: 50_000,
        taxCop: 8_000,
      },
    ],
  });

  const saved = await scene.settle.execute(
    command({ removes: [{ userId: COOK, reason: "Absent" }] }),
  );

  expect(saved?.participants).toEqual([{ userId: WAITER, workedMinutes: 480 }]);
  expect(saved?.shares).toEqual([
    { userId: WAITER, baseCop: 6_000, residueCop: 0 },
  ]);
  expect(saved?.residueCop).toBe(4_000);
  expect(saved?.poolCop).toBe(10_000);
  expect(saved?.rule).toEqual({
    mode: "percentage",
    shares: [
      { employeeId: WAITER, percent: 60 },
      { employeeId: COOK, percent: 40 },
    ],
  });
  expect(saved?.edits).toEqual([
    {
      userId: COOK,
      workedMinutes: null,
      reason: "Absent",
      change: "remove",
    },
  ]);
  expect(scene.commands.map((entry) => entry.action)).toEqual([ACTION]);
  expect(scene.steps).not.toContain("save-rule");
});

it("given a closed settlement, when the same settlement_ id is submitted again, then the first row is returned and nothing else is written", async () => {
  const scene = harness();

  const first = await scene.settle.execute(command());
  scene.steps.splice(0, scene.steps.length);
  scene.tips.push({
    recordedAt: INSIDE_CASH,
    tip: { method: "cash", amountCop: 10_000 },
    saleCop: 1,
    taxCop: 1,
  });

  const second = await scene.settle.execute(command());

  expect(second).toEqual(first);
  expect(second).toEqual(closedDay());
  expect(scene.settlements.rows).toHaveLength(1);
  expect(scene.commands).toHaveLength(1);
  expect(scene.steps).toEqual(["evaluate", "settlements"]);
});

it("given cash.settle-tips is denied, when the caller removes a participant without a reason, then nothing is written and nothing is audited", async () => {
  const scene = harness(denied());

  const saved = await scene.settle.execute(
    command({ removes: [{ userId: COOK, reason: "" }] }),
  );

  expect(saved).toBeNull();
  expect(scene.settlements.rows).toEqual([]);
  expect(scene.commands).toEqual([]);
  expect(scene.steps).toEqual(["evaluate"]);
});

it("given the venue has no tip rule, when settlement is attempted, then nothing is stored and nothing is audited", async () => {
  const scene = harness(allowed(), { rule: null });

  await expect(scene.settle.execute(command())).rejects.toBeInstanceOf(
    MissingTipRule,
  );

  expect(scene.settlements.rows).toEqual([]);
  expect(scene.commands).toEqual([]);
  expect(scene.steps).toEqual(["evaluate", "settlements", "rule"]);
});
