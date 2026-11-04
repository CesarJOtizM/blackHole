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

import { ApplyCourtesy } from "#application/apply-courtesy/apply-courtesy.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import { Check } from "#domain/check.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_a";
const ADMIN_ID = "user_admin";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_courtesy";
const REASON = "Guest courtesy";
const LINE_PRICE = 12_000;
const COURTESY = 20_000;
const RAISED_COURTESY = 30_000;
const COUNTED = { waiterVoidsBeforeKitchen: 0, compShiftCop: 90_000 };
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
  exceededLimit: { code: "compShiftCop", cap: 100_000, unit: "cop" },
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

  override loadCheck(tenantId: string, venueId: string, checkId: string) {
    return Promise.resolve(
      this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null,
    );
  }

  override saveCheck(check: Check) {
    this.steps.push("save");
    this.savedIds.push(check.id);
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
    return Promise.resolve();
  }

  override async saveChecks(checks: readonly Check[]) {
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

  override isOpen(query: typeof SHIFT_QUERY) {
    this.queries.push(query);
    return Promise.resolve(this.open);
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: { tenantId: string; actorId: string; shiftId: string }[] =
    [];

  constructor(private readonly steps: string[]) {
    super(blank);
  }

  override execute(query: (typeof this.queries)[number]) {
    this.steps.push("count");
    this.queries.push(query);
    return Promise.resolve(COUNTED);
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

  override execute(input: (typeof this.inputs)[number]) {
    this.steps.push("evaluate");
    this.inputs.push(input);
    return Promise.resolve(this.decision);
  }
}

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];

  constructor(
    private readonly steps: string[],
    private readonly grant: StoredGrant | null,
    private readonly mode: GrantMode,
  ) {
    super(blank, blank);
  }

  override execute(input: ConsumeAuthorizationInput) {
    this.steps.push("consume");
    this.calls.push(input);

    if (this.mode === "consumed") {
      throw new AuthorizationAlreadyConsumed();
    }

    if (this.mode === "unknown") {
      throw new UnknownAuthorizationReference();
    }

    return Promise.resolve(
      this.grant !== null &&
        input.authorizationId === this.grant.authorizationId &&
        input.permission === PERMISSION.SALE_COMP &&
        input.targetId === this.grant.targetId &&
        input.value === this.grant.value,
    );
  }
}

class RecordingAudit extends RecordAuditEvent {
  readonly commands: AuditCommand[] = [];

  constructor(private readonly steps: string[]) {
    super(blank, blank, blank);
  }

  override execute(command: AuditCommand) {
    this.steps.push("audit");
    this.commands.push(command);
    return Promise.resolve(blank);
  }
}

const command = (
  authorizationId: string | null = null,
  authorizerId: string | null = null,
  value = COURTESY,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  actorId: ADMIN_ID,
  authorizerId,
  sessionId: "session_admin",
  deviceId: "device_register",
  shiftId: SHIFT_ID,
  reason: REASON,
  value,
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
  value: COURTESY,
};

const consumeCall = (value: number): ConsumeAuthorizationInput => ({
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.SALE_COMP,
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
  const grants = new MemoryGrant(steps, options.grant, options.mode ?? "match");
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
    applyCourtesy: new ApplyCourtesy(
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
};

it("given an admin with a courtesy cap of 100000 and 90000 used, when she grants 20000, then the courtesy waits for another person", async () => {
  const { dining, steps, counts, permissions, grants, audits, applyCourtesy } =
    await harness({ decision: overCap(), open: true, grant: null });

  await applyCourtesy.execute(command());

  await expectUnchanged(dining, audits);
  expect(command()).not.toHaveProperty("shiftTotals");
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: ADMIN_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_COMP,
    value: COURTESY,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given a courtesy needing authorization, when a supervisor enters her PIN and a reason, then the audit records requester, authorizer, reason and value", async () => {
  const { dining, steps, grants, audits, applyCourtesy } = await harness({
    decision: overCap(),
    open: true,
    grant: matchingGrant,
  });

  const result = await applyCourtesy.execute(
    command(REQUEST_ID, SUPERVISOR_ID),
  );

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(result.id).toBe(CHECK_ID);
  expect(prices(result)).toEqual([LINE_PRICE]);
  expect(prices(stored)).toEqual([LINE_PRICE]);
  expect(dining.savedIds).toEqual([]);
  expect(grants.calls).toEqual([consumeCall(COURTESY)]);
  expect(steps).toEqual(["count", "evaluate", "consume", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: ADMIN_ID,
    authorizerId: SUPERVISOR_ID,
    deviceId: "device_register",
    siteId: VENUE_ID,
    action: PERMISSION.SALE_COMP,
    entity: CHECK_ID,
    reason: REASON,
    before: { value: 0 },
    after: { value: COURTESY, shiftId: SHIFT_ID, kitchen: null },
  });
});

it("given a courtesy inside the shift cap, when no grant is required, then the audit is written and the grant is not consumed", async () => {
  const { dining, steps, grants, audits, applyCourtesy } = await harness({
    decision: allowed(),
    open: true,
    grant: null,
  });

  await applyCourtesy.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(prices(stored)).toEqual([LINE_PRICE]);
  expect(dining.savedIds).toEqual([]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "audit"]);
  expect(audits.commands[0]?.after).toEqual({
    value: COURTESY,
    shiftId: SHIFT_ID,
    kitchen: null,
  });
});

it.each([
  {
    title:
      "given an approved courtesy of 20000 on account A, when the admin applies 30000, then the courtesy is rejected",
    value: RAISED_COURTESY,
    grant: matchingGrant,
    calls: [consumeCall(RAISED_COURTESY)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given an approved courtesy for another account, when the admin applies 20000 on account A, then the account stays",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: "check_other",
      value: COURTESY,
    },
    calls: [consumeCall(COURTESY)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given the admin is denied a courtesy, when she applies 20000, then the account stays",
    decision: denied(),
    calls: [],
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given a closed shift, when the admin applies a matching courtesy, then the account stays",
    open: false,
    calls: [],
    steps: [],
  },
  {
    title:
      "given a matching grant that was already consumed, when the admin applies the courtesy, then the error is raised and the account stays",
    mode: "consumed" as const,
    calls: [consumeCall(COURTESY)],
    steps: ["count", "evaluate", "consume"],
    thrown: true,
  },
  {
    title:
      "given an unknown authorization reference, when the admin applies the courtesy, then the account stays",
    mode: "unknown" as const,
    calls: [consumeCall(COURTESY)],
    steps: ["count", "evaluate", "consume"],
  },
])("$title", async (row) => {
  const { dining, steps, shifts, grants, audits, applyCourtesy } =
    await harness({
      decision: row.decision ?? overCap(),
      open: row.open ?? true,
      grant: row.grant === undefined ? matchingGrant : row.grant,
      mode: row.mode,
    });
  const run = applyCourtesy.execute(
    command(REQUEST_ID, SUPERVISOR_ID, row.value ?? COURTESY),
  );

  if (row.thrown) {
    await expect(run).rejects.toThrow(AuthorizationAlreadyConsumed);
  } else {
    await run;
  }

  await expectUnchanged(dining, audits);
  expect(grants.calls).toEqual(row.calls);
  expect(steps).toEqual(row.steps);
  if (row.open === false) {
    expect(shifts.queries).toEqual([SHIFT_QUERY]);
  }
});
