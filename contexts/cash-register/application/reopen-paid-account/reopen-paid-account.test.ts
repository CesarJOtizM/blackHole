import {
  AuthorizationAlreadyConsumed,
  ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  CountExecutedOperations,
  type CountExecutedOperationsQuery,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type PaidAccount,
  PaidAccountReader,
  ReopenPaidAccount,
} from "#application/reopen-paid-account/reopen-paid-account.js";
import { CashShift } from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const CLOSED_SHIFT_ID = "shift_closed";
const OPEN_SHIFT_ID = "shift_open";
const PAYMENT_ID = "payment_closed_1";
const OTHER_PAYMENT_ID = "payment_other";
const REVERSAL_ID = "reversal_closed_1";
const REQUEST_ID = "request_reopen";
const REASON = "Paid by mistake";
const SALE_COP = 85_000;
const OPENING_FLOAT = 200_000;
const COUNTED = { waiterVoidsBeforeKitchen: 0, compShiftCop: 0 };
const blank = {} as never;

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type GrantMode = "match" | "consumed" | "unknown";
type Hold = "open" | "closed" | "none";

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

interface Scene {
  title: string;
  sale?: PaidAccount | null;
  hold?: Hold;
  decision?: Decision;
  grant?: StoredGrant | null;
  authorizationId?: string | null;
  mode?: GrantMode;
  steps: string[];
}

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const needsGrant = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: null,
  selfAuthorized: false,
});
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });
const matchingGrant: StoredGrant = {
  authorizationId: REQUEST_ID,
  targetId: PAYMENT_ID,
  value: SALE_COP,
};
const consumeCall = (): ConsumeAuthorizationInput => ({
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.SALE_REOPEN_PAID,
  targetId: PAYMENT_ID,
  value: SALE_COP,
});

const opened = (id: string): CashShift => {
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT,
  });
  return shift;
};

class MemorySales extends PaidAccountReader {
  constructor(private readonly sale: PaidAccount | null) {
    super();
  }

  override find(): Promise<PaidAccount | null> {
    return Promise.resolve(this.sale);
  }
}

class MemoryRegisters extends CashRegisterRepository {
  private stored: CashShift | null;

  constructor(
    private readonly steps: string[],
    shift: CashShift | null,
  ) {
    super();
    this.stored = shift;
  }

  override load(): Promise<CashShift | null> {
    return Promise.resolve(this.stored);
  }

  override save(_tenantId: string, _venueId: string, shift: CashShift) {
    this.steps.push("save");
    this.stored = shift;
    return Promise.resolve();
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: CountExecutedOperationsQuery[] = [];

  constructor(private readonly steps: string[]) {
    super(blank);
  }

  override execute(query: CountExecutedOperationsQuery) {
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
        input.permission === PERMISSION.SALE_REOPEN_PAID &&
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
  authorizationId: string | null,
  authorizerId: string | null = null,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  paymentId: PAYMENT_ID,
  reversalId: REVERSAL_ID,
  actorId: CASHIER_ID,
  authorizerId,
  sessionId: "session_cashier",
  deviceId: "device_register",
  reason: REASON,
  authorizationId,
});

const heldShift = (closed: CashShift, hold: Hold): CashShift | null => {
  if (hold === "none") {
    return null;
  }
  if (hold === "closed") {
    return closed;
  }
  return opened(OPEN_SHIFT_ID);
};

const harness = (scene: Partial<Scene> = {}) => {
  const steps: string[] = [];
  const closed = opened(CLOSED_SHIFT_ID);
  const hold = scene.hold ?? "open";
  const registers = new MemoryRegisters(steps, heldShift(closed, hold));
  const permissions = new ScriptedPermission(
    steps,
    scene.decision ?? needsGrant(),
  );
  const grants = new MemoryGrant(
    steps,
    scene.grant === undefined ? matchingGrant : scene.grant,
    scene.mode ?? "match",
  );
  const audits = new RecordingAudit(steps);
  const counts = new FixedCounts(steps);
  const sale =
    scene.sale === undefined
      ? { paymentId: PAYMENT_ID, amountCop: SALE_COP, shiftId: closed.id ?? "" }
      : scene.sale;
  return {
    steps,
    closed,
    registers,
    permissions,
    grants,
    audits,
    counts,
    reopen: new ReopenPaidAccount(
      new MemorySales(sale),
      registers,
      counts,
      permissions,
      grants,
      audits,
    ),
  };
};

const reopenedAudit = (authorizerId: string | null): AuditCommand => ({
  tenantId: TENANT_ID,
  actorId: CASHIER_ID,
  authorizerId,
  deviceId: "device_register",
  siteId: VENUE_ID,
  action: PERMISSION.SALE_REOPEN_PAID,
  entity: PAYMENT_ID,
  before: { value: 0 },
  after: { value: SALE_COP, shiftId: OPEN_SHIFT_ID, kitchen: null },
  reason: REASON,
});

const reversal = {
  id: REVERSAL_ID,
  originalPaymentId: PAYMENT_ID,
  amountCop: SALE_COP,
};

const refusals: Scene[] = [
  {
    title:
      "given the paid account is missing, when the cashier reopens it, then neither shift changes",
    sale: null,
    steps: [],
  },
  {
    title:
      "given no open shift, when the cashier reopens a paid account, then the closed shift stays unchanged",
    hold: "none",
    steps: [],
  },
  {
    title:
      "given the loaded shift is the closed shift, when the cashier reopens the account, then that shift is not mutated",
    hold: "closed",
    steps: [],
  },
  {
    title:
      "given sale.reopen-paid is denied, when the cashier reopens the account, then the closed shift and the open shift stay unchanged",
    decision: denied(),
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given no authorization, when the cashier reopens the account, then neither shift changes",
    grant: null,
    authorizationId: null,
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given a grant for another payment, when the cashier reopens this account, then neither shift changes",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: OTHER_PAYMENT_ID,
      value: SALE_COP,
    },
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given a grant for another amount, when the cashier reopens this account, then neither shift changes",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: PAYMENT_ID,
      value: SALE_COP - 1,
    },
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given an unknown authorization reference, when the cashier reopens the account, then neither shift changes",
    mode: "unknown",
    steps: ["count", "evaluate", "consume"],
  },
];

const expectUnchanged = async (
  scene: ReturnType<typeof harness>,
  beforeId: string | undefined,
) => {
  const stored = await scene.registers.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(scene.closed.reversals).toEqual([]);
  expect(scene.closed.movements).toEqual([]);
  expect(stored?.id).toBe(beforeId);
  expect(stored?.reversals ?? []).toEqual([]);
  expect(stored?.movements ?? []).toEqual([]);
  expect(scene.audits.commands).toEqual([]);
};

it("given the sale belongs to a closed shift, when the account is reopened with authorization, then the reversal lands on the open shift and points at the original payment", async () => {
  const scene = harness();
  await scene.reopen.execute(command(REQUEST_ID, SUPERVISOR_ID));
  const stored = await scene.registers.load(TENANT_ID, VENUE_ID, REGISTER_ID);

  expect(scene.closed.reversals).toEqual([]);
  expect(scene.closed.id).toBe(CLOSED_SHIFT_ID);
  expect(stored?.id).toBe(OPEN_SHIFT_ID);
  expect(stored?.reversals).toEqual([reversal]);
  expect(stored?.movements).toEqual([]);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT);
  expect(scene.audits.commands).toEqual([reopenedAudit(SUPERVISOR_ID)]);
  expect(scene.grants.calls).toEqual([consumeCall()]);
  expect(scene.counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: CASHIER_ID, shiftId: OPEN_SHIFT_ID },
  ]);
  expect(scene.permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_REOPEN_PAID,
    value: SALE_COP,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(scene.steps).toEqual([
    "count",
    "evaluate",
    "consume",
    "save",
    "audit",
  ]);
});

it("given sale.reopen-paid is allowed, when the cashier reopens the account, then the reversal is audited and the grant is not consumed", async () => {
  const scene = harness({ decision: allowed() });
  await scene.reopen.execute(command(REQUEST_ID));
  const stored = await scene.registers.load(TENANT_ID, VENUE_ID, REGISTER_ID);

  expect(stored?.reversals).toEqual([reversal]);
  expect(scene.closed.reversals).toEqual([]);
  expect(scene.audits.commands).toEqual([reopenedAudit(null)]);
  expect(scene.grants.calls).toEqual([]);
  expect(scene.steps).toEqual(["count", "evaluate", "save", "audit"]);
});

it.each(refusals)("$title", async (refusal) => {
  const scene = harness(refusal);
  const beforeId = (
    await scene.registers.load(TENANT_ID, VENUE_ID, REGISTER_ID)
  )?.id;
  await scene.reopen.execute(
    command(
      refusal.authorizationId === undefined
        ? REQUEST_ID
        : refusal.authorizationId,
    ),
  );
  await expectUnchanged(scene, beforeId);
  expect(scene.grants.calls).toEqual(
    refusal.steps.includes("consume") ? [consumeCall()] : [],
  );
  expect(scene.steps).toEqual(refusal.steps);
});

it("given an already consumed grant, when the cashier reopens the account, then AuthorizationAlreadyConsumed is rethrown and both shifts stay unchanged", async () => {
  const scene = harness({ mode: "consumed" });
  const beforeId = (
    await scene.registers.load(TENANT_ID, VENUE_ID, REGISTER_ID)
  )?.id;
  await expect(
    scene.reopen.execute(command(REQUEST_ID, SUPERVISOR_ID)),
  ).rejects.toBeInstanceOf(AuthorizationAlreadyConsumed);
  await expectUnchanged(scene, beforeId);
  expect(scene.steps).toEqual(["count", "evaluate", "consume"]);
});
