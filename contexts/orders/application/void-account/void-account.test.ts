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
import { expect, it, vi } from "vitest";

import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import { VoidAccount } from "#application/void-account/void-account.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const LINE_ID = "line_soup";
const OTHER_LINE_ID = "line_bread";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const SESSION_ID = "session_cashier";
const DEVICE_ID = "device_register";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_void_account";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const REASON = "Customer cancelled the account";
const ACCOUNT_VALUE = 16_000;

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

const blank = {} as never;

const allowed = (): Decision => ({
  outcome: "allowed",
  selfAuthorized: false,
});

const needsGrant = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: null,
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

const lineIds = (check: Check | null): string[] =>
  check?.orders.flatMap((order) => order.lines.map((line) => line.id)) ?? [];

class MemoryDiningRoom extends DiningRoomRepository {
  readonly steps: string[];
  readonly savedIds: string[] = [];
  tableSaves = 0;
  private readonly checks = new Map<string, Check>();

  constructor(steps: string[]) {
    super();
    this.steps = steps;
  }

  override async load(
    _tenantId: string,
    _venueId: string,
    _tableId: string,
  ): Promise<DiningTable | null> {
    return null;
  }

  override async save(_table: DiningTable): Promise<void> {
    this.tableSaves += 1;
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
  readonly queries: { tenantId: string; venueId: string; shiftId: string }[] =
    [];

  constructor(private readonly open: boolean) {
    super();
  }

  override async isOpen(query: {
    tenantId: string;
    venueId: string;
    shiftId: string;
  }): Promise<boolean> {
    this.queries.push(query);
    return this.open;
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: { tenantId: string; actorId: string; shiftId: string }[] =
    [];

  constructor(
    private readonly steps: string[],
    private readonly totals: {
      waiterVoidsBeforeKitchen: number;
      compShiftCop: number;
    },
  ) {
    super(blank);
  }

  override async execute(query: {
    tenantId: string;
    actorId: string;
    shiftId: string;
  }) {
    this.steps.push("count");
    this.queries.push(query);
    return this.totals;
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

  override async execute(input: Parameters<EvaluatePermission["execute"]>[0]) {
    this.steps.push("evaluate");
    this.inputs.push(input);
    return this.decision;
  }
}

type GrantMode = "match" | "consumed" | "unknown";

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];
  accountPresentAtConsume = false;

  constructor(
    private readonly steps: string[],
    private readonly dining: MemoryDiningRoom,
    private readonly grant: StoredGrant | null,
    private readonly mode: GrantMode,
  ) {
    super(blank, blank);
  }

  override async execute(input: ConsumeAuthorizationInput): Promise<boolean> {
    this.steps.push("consume");
    this.calls.push(input);
    const stored = await this.dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
    this.accountPresentAtConsume = lineIds(stored).length > 0;

    if (this.mode === "consumed") {
      throw new AuthorizationAlreadyConsumed();
    }

    if (this.mode === "unknown") {
      throw new UnknownAuthorizationReference();
    }

    if (this.grant === null) {
      return false;
    }

    return (
      input.authorizationId === this.grant.authorizationId &&
      input.permission === PERMISSION.SALE_VOID_ACCOUNT &&
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
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  actorId: CASHIER_ID,
  authorizerId,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  shiftId: SHIFT_ID,
  reason: REASON,
  authorizationId,
});

const openAccount = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: ORDER_ID,
    lineId: LINE_ID,
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: ORDER_ID,
    lineId: OTHER_LINE_ID,
    productId: "menu_product_bread",
    name: "Bread",
    course: 1,
    price: 4_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.requestCheck({ requestedAt: SENT_AT });

  return check;
};

const matchingGrant = {
  authorizationId: REQUEST_ID,
  targetId: CHECK_ID,
  value: ACCOUNT_VALUE,
};

const harness = async (options: {
  decision: Decision;
  open: boolean;
  grant: StoredGrant | null;
  mode?: GrantMode;
}) => {
  const steps: string[] = [];
  const dining = new MemoryDiningRoom(steps);
  const shifts = new MemoryShift(options.open);
  const counts = new FixedCounts(steps, {
    waiterVoidsBeforeKitchen: 0,
    compShiftCop: 0,
  });
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
    voidAccount: new VoidAccount(
      dining,
      shifts,
      counts,
      permissions,
      grants,
      audits,
    ),
  };
};

it("given an authorized void of the whole account, when the grant matches the account, then the grant is consumed before the account is cleared", async () => {
  const {
    dining,
    steps,
    shifts,
    counts,
    permissions,
    grants,
    audits,
    voidAccount,
  } = await harness({
    decision: needsGrant(),
    open: true,
    grant: matchingGrant,
  });
  const transfer = vi.spyOn(Check.prototype, "transfer");
  const join = vi.spyOn(Check.prototype, "join");

  await voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(grants.accountPresentAtConsume).toBe(true);
  expect(lineIds(stored)).toEqual([]);
  expect(stored?.id).toBe(CHECK_ID);
  expect(stored?.total).toBe(0);
  expect(await dining.loadCheck(TENANT_ID, VENUE_ID, "check_void_sink")).toBe(
    null,
  );
  expect(transfer).not.toHaveBeenCalled();
  expect(join).not.toHaveBeenCalled();
  expect(dining.tableSaves).toBe(0);
  expect(dining.savedIds).toEqual([CHECK_ID]);
  expect(shifts.queries).toEqual([
    { tenantId: TENANT_ID, venueId: VENUE_ID, shiftId: SHIFT_ID },
  ]);
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: CASHIER_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_VOID_ACCOUNT,
    value: ACCOUNT_VALUE,
    shiftTotals: { waiterVoidsBeforeKitchen: 0, compShiftCop: 0 },
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(grants.calls).toEqual([
    {
      tenantId: TENANT_ID,
      authorizationId: REQUEST_ID,
      permission: PERMISSION.SALE_VOID_ACCOUNT,
      targetId: CHECK_ID,
      value: ACCOUNT_VALUE,
    },
  ]);
  expect(steps).toEqual(["count", "evaluate", "consume", "save", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: CASHIER_ID,
    authorizerId: SUPERVISOR_ID,
    deviceId: DEVICE_ID,
    siteId: VENUE_ID,
    action: PERMISSION.SALE_VOID_ACCOUNT,
    entity: CHECK_ID,
    reason: REASON,
    after: { value: ACCOUNT_VALUE, shiftId: SHIFT_ID, kitchen: null },
  });
  expect(audits.commands[0]?.before).not.toEqual(audits.commands[0]?.after);
  transfer.mockRestore();
  join.mockRestore();
});

it("given permission to void an account, when no grant is required, then the lines leave and the grant is not consumed", async () => {
  const { dining, steps, grants, voidAccount } = await harness({
    decision: allowed(),
    open: true,
    grant: null,
  });

  await voidAccount.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "save", "audit"]);
});

it("given authorization is required, when the grant is missing, then the account stays", async () => {
  const { dining, steps, grants, audits, voidAccount } = await harness({
    decision: needsGrant(),
    open: true,
    grant: null,
  });

  await voidAccount.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(stored?.tableState).toBe("check_requested");
  expect(grants.calls).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given authorization is required, when the grant targets another account, then the account stays", async () => {
  const { dining, grants, voidAccount } = await harness({
    decision: needsGrant(),
    open: true,
    grant: {
      authorizationId: REQUEST_ID,
      targetId: "check_other",
      value: ACCOUNT_VALUE,
    },
  });

  await voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(grants.accountPresentAtConsume).toBe(true);
  expect(grants.calls).toEqual([
    {
      tenantId: TENANT_ID,
      authorizationId: REQUEST_ID,
      permission: PERMISSION.SALE_VOID_ACCOUNT,
      targetId: CHECK_ID,
      value: ACCOUNT_VALUE,
    },
  ]);
});

it("given the cashier is denied voiding an account, when she voids it, then the account stays", async () => {
  const { dining, steps, grants, voidAccount } = await harness({
    decision: denied(),
    open: true,
    grant: matchingGrant,
  });

  await voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given a closed shift, when the cashier voids an account with a matching grant, then the account stays", async () => {
  const { dining, steps, shifts, grants, voidAccount } = await harness({
    decision: needsGrant(),
    open: false,
    grant: matchingGrant,
  });

  await voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(shifts.queries).toEqual([
    { tenantId: TENANT_ID, venueId: VENUE_ID, shiftId: SHIFT_ID },
  ]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual([]);
});

it("given a matching grant that was already consumed, when the cashier voids the account, then the error is raised and the account stays", async () => {
  const { dining, steps, voidAccount } = await harness({
    decision: needsGrant(),
    open: true,
    grant: matchingGrant,
    mode: "consumed",
  });

  await expect(
    voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID)),
  ).rejects.toThrow(AuthorizationAlreadyConsumed);

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(steps).toEqual(["count", "evaluate", "consume"]);
});

it("given an unknown authorization reference, when the cashier voids the account, then the account stays", async () => {
  const { dining, steps, audits, voidAccount } = await harness({
    decision: needsGrant(),
    open: true,
    grant: matchingGrant,
    mode: "unknown",
  });

  await voidAccount.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineIds(stored)).toEqual([LINE_ID, OTHER_LINE_ID]);
  expect(audits.commands).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "consume"]);
});
