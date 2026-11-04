import {
  AuthorizationAlreadyConsumed,
  ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  CountExecutedOperations,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import { ApplyDiscount } from "#application/apply-discount/apply-discount.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import { Check } from "#domain/check.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_a";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_discount";
const REASON = "Loyalty discount";
const LINE_PRICE = 12_000;
const PERCENT = 10;
const RAISED_PERCENT = 20;
const COUNTED = { waiterVoidsBeforeKitchen: 2, compShiftCop: 90_000 };
const SHIFT_QUERY = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  shiftId: SHIFT_ID,
};

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type GrantMode = "match" | "consumed" | "unknown";

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

const blank = {} as never;

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });

const overCap = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: { code: "discountPercent", cap: 5, unit: "percent" },
  selfAuthorized: false,
});

const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const prices = (check: Check | null): number[] =>
  check?.orders.flatMap((order) => order.lines.map((line) => line.price)) ?? [];

class MemoryDiningRoom extends DiningRoomRepository {
  readonly savedIds: string[] = [];
  private readonly checks = new Map<string, Check>();

  constructor(private readonly steps: string[]) {
    super();
  }

  override load() {
    return Promise.resolve(null);
  }

  override save() {
    return Promise.resolve();
  }

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.steps.push("save");
    this.savedIds.push(check.id);
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }
}

class MemoryShift extends OpenShiftReader {
  readonly queries: (typeof SHIFT_QUERY)[] = [];

  constructor(private readonly open: boolean) {
    super();
  }

  override async isOpen(query: typeof SHIFT_QUERY): Promise<boolean> {
    this.queries.push(query);
    return this.open;
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: { tenantId: string; actorId: string; shiftId: string }[] =
    [];

  constructor(private readonly steps: string[]) {
    super(blank);
  }

  override async execute(query: (typeof this.queries)[number]) {
    this.steps.push("count");
    this.queries.push(query);
    return COUNTED;
  }
}

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: Parameters<EvaluatePermission["execute"]>[0][] = [];

  constructor(
    private readonly steps: string[],
    private readonly decision: Decision,
  ) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: (typeof this.inputs)[number]) {
    this.steps.push("evaluate");
    this.inputs.push(input);
    return this.decision;
  }
}

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];
  pricesHeld = false;

  constructor(
    private readonly steps: string[],
    private readonly dining: DiningRoomRepository,
    private readonly grant: StoredGrant | null,
    private readonly mode: GrantMode,
  ) {
    super(blank, blank);
  }

  override async execute(input: ConsumeAuthorizationInput): Promise<boolean> {
    this.steps.push("consume");
    this.calls.push(input);
    this.pricesHeld =
      prices(
        await this.dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID),
      ).join() === String(LINE_PRICE);

    if (this.mode === "consumed") {
      throw new AuthorizationAlreadyConsumed();
    }

    if (this.mode === "unknown") {
      throw new UnknownAuthorizationReference();
    }

    return (
      this.grant !== null &&
      input.authorizationId === this.grant.authorizationId &&
      input.permission === PERMISSION.SALE_DISCOUNT &&
      input.targetId === this.grant.targetId &&
      input.value === this.grant.value
    );
  }
}

class RecordingAudit extends RecordAuditEvent {
  readonly commands: AuditCommand[] = [];

  constructor(private readonly steps: string[]) {
    super(blank, blank, blank);
  }

  override async execute(command: AuditCommand) {
    this.steps.push("audit");
    this.commands.push(command);
    return blank;
  }
}

const command = (
  authorizationId: string | null = null,
  authorizerId: string | null = null,
  percent = PERCENT,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  actorId: CASHIER_ID,
  authorizerId,
  sessionId: "session_cashier",
  deviceId: "device_register",
  shiftId: SHIFT_ID,
  reason: REASON,
  percent,
  authorizationId,
});

const openAccount = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: "table_5",
    openedAt: "2026-10-28T12:00:00.000Z",
  });
  check.addLine({
    orderId: "order_1",
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: LINE_PRICE,
    channel: "waiter",
  });
  return check;
};

const matchingGrant = {
  authorizationId: REQUEST_ID,
  targetId: CHECK_ID,
  value: PERCENT,
};

const consumeCall = (value: number): ConsumeAuthorizationInput => ({
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.SALE_DISCOUNT,
  targetId: CHECK_ID,
  value,
});

const harness = async (options: {
  decision: Decision;
  open: boolean;
  grant: StoredGrant | null;
  mode?: GrantMode;
}) => {
  const steps: string[] = [];
  const dining = new MemoryDiningRoom(steps);
  const shifts = new MemoryShift(options.open);
  const counts = new FixedCounts(steps);
  const permissions = new ScriptedPermission(steps, options.decision);
  const grants = new MemoryGrant(
    steps,
    dining,
    options.grant,
    options.mode ?? "match",
  );
  const audits = new RecordingAudit(steps);
  await dining.saveCheck(openAccount());
  steps.length = 0;
  dining.savedIds.length = 0;

  return {
    steps,
    dining,
    shifts,
    counts,
    permissions,
    grants,
    audits,
    applyDiscount: new ApplyDiscount(
      dining,
      shifts,
      counts,
      permissions,
      grants,
      audits,
    ),
  };
};

const expectUnchanged = async (
  dining: MemoryDiningRoom,
  audits: RecordingAudit,
) => {
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(prices(stored)).toEqual([LINE_PRICE]);
  expect(dining.savedIds).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await dining.loadCheck(TENANT_ID, VENUE_ID, "check_void_sink")).toBe(
    null,
  );
};

it("given a cashier with a 5 percent cap, when she applies 10 percent, then the discount waits and the account stays", async () => {
  const { dining, steps, counts, permissions, grants, audits, applyDiscount } =
    await harness({ decision: overCap(), open: true, grant: null });

  await applyDiscount.execute(command());

  await expectUnchanged(dining, audits);
  expect(command()).not.toHaveProperty("shiftTotals");
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: CASHIER_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_DISCOUNT,
    value: PERCENT,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given an approved discount of 10 percent on account A, when the cashier applies 10 percent on account A, then the grant is consumed before the audit and the prices stay", async () => {
  const { dining, steps, shifts, grants, audits, applyDiscount } =
    await harness({ decision: overCap(), open: true, grant: matchingGrant });

  const result = await applyDiscount.execute(
    command(REQUEST_ID, SUPERVISOR_ID),
  );

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(prices(result)).toEqual([LINE_PRICE]);
  expect(prices(stored)).toEqual([LINE_PRICE]);
  expect(grants.pricesHeld).toBe(true);
  expect(dining.savedIds).toEqual([]);
  expect(await dining.loadCheck(TENANT_ID, VENUE_ID, "check_void_sink")).toBe(
    null,
  );
  expect(shifts.queries).toEqual([SHIFT_QUERY]);
  expect(grants.calls).toEqual([consumeCall(PERCENT)]);
  expect(steps).toEqual(["count", "evaluate", "consume", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: CASHIER_ID,
    authorizerId: SUPERVISOR_ID,
    deviceId: "device_register",
    siteId: VENUE_ID,
    action: PERMISSION.SALE_DISCOUNT,
    entity: CHECK_ID,
    reason: REASON,
    after: { value: PERCENT, shiftId: SHIFT_ID, kitchen: null },
  });
  expect(audits.commands[0]?.before).not.toEqual(audits.commands[0]?.after);
});

it("given a discount inside the percent cap, when no grant is required, then the audit is written and the grant is not consumed", async () => {
  const { dining, steps, grants, audits, applyDiscount } = await harness({
    decision: allowed(),
    open: true,
    grant: null,
  });

  await applyDiscount.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(prices(stored)).toEqual([LINE_PRICE]);
  expect(dining.savedIds).toEqual([]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "audit"]);
  expect(audits.commands[0]?.after).toEqual({
    value: PERCENT,
    shiftId: SHIFT_ID,
    kitchen: null,
  });
});

it.each([
  {
    title:
      "given an approved discount of 10 percent on account A, when the cashier applies 20 percent, then the discount is rejected",
    percent: RAISED_PERCENT,
    grant: matchingGrant,
    calls: [consumeCall(RAISED_PERCENT)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given an approved discount for another account, when the cashier applies 10 percent on account A, then the account stays",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: "check_other",
      value: PERCENT,
    },
    calls: [consumeCall(PERCENT)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given the cashier is denied a discount, when she applies 10 percent, then the account stays",
    decision: denied(),
    calls: [],
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given a closed shift, when the cashier applies a matching discount, then the account stays",
    open: false,
    calls: [],
    steps: [],
  },
  {
    title:
      "given a matching grant that was already consumed, when the cashier applies the discount, then the error is raised and the account stays",
    mode: "consumed" as const,
    calls: [consumeCall(PERCENT)],
    steps: ["count", "evaluate", "consume"],
    thrown: true,
  },
  {
    title:
      "given an unknown authorization reference, when the cashier applies the discount, then the account stays",
    mode: "unknown" as const,
    calls: [consumeCall(PERCENT)],
    steps: ["count", "evaluate", "consume"],
  },
])("$title", async (row) => {
  const { dining, steps, shifts, grants, audits, applyDiscount } =
    await harness({
      decision: row.decision ?? overCap(),
      open: row.open ?? true,
      grant: row.grant === undefined ? matchingGrant : row.grant,
      mode: row.mode,
    });
  const run = applyDiscount.execute(
    command(REQUEST_ID, SUPERVISOR_ID, row.percent ?? PERCENT),
  );

  if (row.thrown) {
    await expect(run).rejects.toThrow(AuthorizationAlreadyConsumed);
  } else {
    await run;
  }

  await expectUnchanged(dining, audits);
  expect(grants.calls).toEqual(row.calls);
  expect(steps).toEqual(row.steps);
  if (row.calls.length > 0) {
    expect(grants.pricesHeld).toBe(true);
  }
  if (row.open === false) {
    expect(shifts.queries).toEqual([SHIFT_QUERY]);
  }
});
