import {
  ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  CountExecutedOperations,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import { VoidLine } from "#application/void-line/void-line.js";
import { Check, type LineState } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const LINE_ID = "line_soup";
const OTHER_LINE_ID = "line_bread";
const WAITER_ID = "user_waiter";
const SUPERVISOR_ID = "user_supervisor";
const SESSION_ID = "session_waiter";
const DEVICE_ID = "device_waiter";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_void";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const PREPARED_AT = "2026-10-28T12:05:00.000Z";
const READY_AT = "2026-10-28T12:11:00.000Z";
const DELIVERED_AT = "2026-10-28T12:16:00.000Z";
const REASON = "Customer sent the soup back";
const VOID_VALUE = 1;

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
  exceededLimit: { code: "waiterVoidCount", cap: 3, unit: "count" },
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

class MemoryDiningRoom extends DiningRoomRepository {
  readonly steps: string[];
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

  override async save(_table: DiningTable): Promise<void> {}

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.steps.push("save");
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

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];
  linePresentAtConsume = false;

  constructor(
    private readonly steps: string[],
    private readonly dining: MemoryDiningRoom,
    private readonly grant: StoredGrant | null,
  ) {
    super(blank, blank);
  }

  override async execute(input: ConsumeAuthorizationInput): Promise<boolean> {
    this.steps.push("consume");
    this.calls.push(input);
    const stored = await this.dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
    this.linePresentAtConsume =
      stored?.orders.some((order) =>
        order.lines.some((line) => line.id === LINE_ID),
      ) ?? false;

    if (this.grant === null) {
      return false;
    }

    return (
      input.authorizationId === this.grant.authorizationId &&
      input.permission === PERMISSION.SALE_VOID_BEFORE_KITCHEN &&
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
  lineId: LINE_ID,
  actorId: WAITER_ID,
  authorizerId,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  shiftId: SHIFT_ID,
  reason: REASON,
  authorizationId,
});

const openCheck = (state: LineState): Check => {
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
    course: 2,
    price: 4_000,
    channel: "waiter",
  });

  if (state === "held") {
    return check;
  }

  check.send({ course: 1, sentAt: SENT_AT });

  if (state === "sent") {
    return check;
  }

  check.advance({
    lineId: LINE_ID,
    state: "in_preparation",
    at: PREPARED_AT,
  });

  if (state === "in_preparation") {
    return check;
  }

  check.advance({ lineId: LINE_ID, state: "ready", at: READY_AT });

  if (state === "ready") {
    return check;
  }

  check.advance({ lineId: LINE_ID, state: "delivered", at: DELIVERED_AT });

  return check;
};

const lineState = (check: Check | null, lineId: string): LineState | null =>
  check?.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId)?.state ?? null;

interface StockCommand {
  tenantId: string;
  venueId: string;
  generation: number;
  orderLineId: string;
  productId: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  portions: number;
  occurredAt: string;
  actorId?: string;
  reason?: string;
  recipeVersion?: number;
}

interface SaleReversalDouble {
  saleConsumptionEnabled: boolean;
  returnStock: {
    execute(input: StockCommand): Promise<{ missingRecipe: boolean }>;
  };
  recordWaste: {
    execute(input: StockCommand): Promise<{ missingRecipe: boolean }>;
  };
  generationOf(tenantId: string, venueId: string): Promise<number>;
}

const GENERATION = 4;

const recordingReversal = (
  enabled: boolean,
): {
  sale: SaleReversalDouble;
  returns: StockCommand[];
  wastes: StockCommand[];
} => {
  const returns: StockCommand[] = [];
  const wastes: StockCommand[] = [];
  const sale: SaleReversalDouble = {
    saleConsumptionEnabled: enabled,
    generationOf: async () => GENERATION,
    returnStock: {
      execute: async (input) => {
        returns.push(input);
        return { missingRecipe: false };
      },
    },
    recordWaste: {
      execute: async (input) => {
        wastes.push(input);
        return { missingRecipe: false };
      },
    },
  };

  return { sale, returns, wastes };
};

const harness = async (
  check: Check,
  options: {
    totals: { waiterVoidsBeforeKitchen: number; compShiftCop: number };
    decision: Decision;
    open: boolean;
    grant: StoredGrant | null;
  },
  sale?: SaleReversalDouble,
) => {
  const steps: string[] = [];
  const dining = new MemoryDiningRoom(steps);
  const shifts = new MemoryShift(options.open);
  const counts = new FixedCounts(steps, options.totals);
  const permissions = new ScriptedPermission(steps, options.decision);
  const grants = new MemoryGrant(steps, dining, options.grant);
  const audits = new RecordingAudit(steps);

  await dining.saveCheck(check);
  steps.length = 0;

  return {
    steps,
    dining,
    shifts,
    counts,
    permissions,
    grants,
    audits,
    voidLine: new VoidLine(
      dining,
      shifts,
      counts,
      permissions,
      grants,
      audits,
      sale,
    ),
  };
};

const withinCap = {
  totals: { waiterVoidsBeforeKitchen: 2, compShiftCop: 0 },
  decision: allowed(),
  open: true,
  grant: null,
};

const overCap = {
  totals: { waiterVoidsBeforeKitchen: 3, compShiftCop: 0 },
  decision: needsGrant(),
  open: true,
  grant: null as StoredGrant | null,
};

it("given a waiter with 2 of 3 allowed voids this shift, when she voids a sent line not yet started, then the line leaves the account", async () => {
  const {
    dining,
    steps,
    shifts,
    counts,
    permissions,
    grants,
    audits,
    voidLine,
  } = await harness(openCheck("sent"), withinCap);

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(lineState(stored, OTHER_LINE_ID)).toBe("held");
  expect(shifts.queries).toEqual([
    { tenantId: TENANT_ID, venueId: VENUE_ID, shiftId: SHIFT_ID },
  ]);
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: WAITER_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
    value: VOID_VALUE,
    shiftTotals: { waiterVoidsBeforeKitchen: 2, compShiftCop: 0 },
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "save", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: WAITER_ID,
    authorizerId: null,
    deviceId: DEVICE_ID,
    siteId: VENUE_ID,
    action: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
    entity: LINE_ID,
    reason: REASON,
    after: { value: VOID_VALUE, shiftId: SHIFT_ID, kitchen: "before" },
  });
  expect(audits.commands[0]?.before).not.toEqual(audits.commands[0]?.after);
});

it("given a held line and 2 of 3 allowed voids this shift, when the waiter voids it on an open shift, then the line leaves the account", async () => {
  const { dining, grants, voidLine } = await harness(
    openCheck("held"),
    withinCap,
  );

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(lineState(stored, OTHER_LINE_ID)).toBe("held");
  expect(grants.calls).toEqual([]);
});

it("given a line in preparation or later, when the waiter voids it within the cap, then the line leaves on the after-kitchen permission", async () => {
  for (const state of ["in_preparation", "ready", "delivered"] as const) {
    const { dining, steps, permissions, grants, audits, voidLine } =
      await harness(openCheck(state), withinCap);

    await voidLine.execute(command());

    const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
    expect(lineState(stored, LINE_ID)).toBeNull();
    expect(lineState(stored, OTHER_LINE_ID)).toBe("held");
    expect(permissions.inputs[0]).toMatchObject({
      permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      value: 12_000,
    });
    expect(grants.calls).toEqual([]);
    expect(audits.commands[0]).toMatchObject({
      action: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      reason: REASON,
      after: { kitchen: "after", value: 12_000, shiftId: SHIFT_ID },
    });
    expect(steps).toEqual(["count", "evaluate", "save", "audit"]);
  }
});

it("given a closed shift, when the waiter voids a sent line within the cap, then the line stays", async () => {
  const { dining, steps, shifts, grants, voidLine } = await harness(
    openCheck("sent"),
    { ...withinCap, open: false },
  );

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBe("sent");
  expect(shifts.queries).toEqual([
    { tenantId: TENANT_ID, venueId: VENUE_ID, shiftId: SHIFT_ID },
  ]);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual([]);
});

it("given the before-kitchen cap is already spent, when the grant is missing, then the line stays", async () => {
  const { dining, grants, voidLine } = await harness(
    openCheck("sent"),
    overCap,
  );

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBe("sent");
  expect(grants.calls).toEqual([]);
});

it("given the before-kitchen cap is already spent, when the grant targets another line, then the line stays", async () => {
  const { dining, grants, voidLine } = await harness(openCheck("sent"), {
    ...overCap,
    grant: {
      authorizationId: REQUEST_ID,
      targetId: OTHER_LINE_ID,
      value: VOID_VALUE,
    },
  });

  await voidLine.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBe("sent");
  expect(grants.calls).toEqual([
    {
      tenantId: TENANT_ID,
      authorizationId: REQUEST_ID,
      permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
      targetId: LINE_ID,
      value: VOID_VALUE,
    },
  ]);
  expect(grants.linePresentAtConsume).toBe(true);
});

it("given the before-kitchen cap is already spent and the grant matches the line, when the waiter voids a sent line, then the grant is consumed before the line leaves", async () => {
  const { dining, steps, grants, audits, voidLine } = await harness(
    openCheck("sent"),
    {
      ...overCap,
      grant: {
        authorizationId: REQUEST_ID,
        targetId: LINE_ID,
        value: VOID_VALUE,
      },
    },
  );

  await voidLine.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(grants.linePresentAtConsume).toBe(true);
  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(lineState(stored, OTHER_LINE_ID)).toBe("held");
  expect(steps).toEqual(["count", "evaluate", "consume", "save", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: WAITER_ID,
    authorizerId: SUPERVISOR_ID,
    action: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
    after: { value: VOID_VALUE, shiftId: SHIFT_ID, kitchen: "before" },
  });
});

it("given the waiter is denied the before-kitchen void, when she voids a sent line, then the line stays", async () => {
  const { dining, steps, grants, voidLine } = await harness(openCheck("sent"), {
    ...withinCap,
    decision: denied(),
  });

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBe("sent");
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given a sent QR table line, when the waiter voids it within the cap, then it uses the before-kitchen void", async () => {
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
    channel: "qr_table",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  const { dining, permissions, voidLine } = await harness(check, withinCap);

  expect(check.orders[0]?.channel).toBe("qr_table");
  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(permissions.inputs[0]?.permission).toBe(
    PERMISSION.SALE_VOID_BEFORE_KITCHEN,
  );
});

const sentWithRecipe = (): Check => {
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
    variantIds: ["menu_variant_single"],
    modifierIds: ["menu_modifier_extra_cheese"],
  });
  check.addLine({
    orderId: ORDER_ID,
    lineId: OTHER_LINE_ID,
    productId: "menu_product_bread",
    name: "Bread",
    course: 2,
    price: 4_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });

  return check;
};

it("given a sent line and sale consumption on, when the waiter voids it before the kitchen starts, then stock is returned for the stored line and waste is not recorded", async () => {
  const { sale, returns, wastes } = recordingReversal(true);
  const { dining, voidLine } = await harness(sentWithRecipe(), withinCap, sale);

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(returns).toEqual([
    expect.objectContaining({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      generation: GENERATION,
      orderLineId: LINE_ID,
      productId: "menu_product_soup",
      variantIds: ["menu_variant_single"],
      modifierIds: ["menu_modifier_extra_cheese"],
      portions: 1,
    }),
  ]);
  expect(returns[0]).not.toHaveProperty("recipeVersion");
  expect(returns[0]).not.toHaveProperty("actorId");
  expect(wastes).toEqual([]);
});

it("given a line the kitchen already started and sale consumption on, when the waiter voids it, then waste records the reason and actor and stock is not returned", async () => {
  for (const state of ["in_preparation", "ready", "delivered"] as const) {
    const { sale, returns, wastes } = recordingReversal(true);
    const { dining, permissions, audits, voidLine } = await harness(
      openCheck(state),
      withinCap,
      sale,
    );

    await voidLine.execute(command());

    const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

    expect(lineState(stored, LINE_ID)).toBeNull();
    expect(permissions.inputs[0]).toMatchObject({
      permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      value: 12_000,
    });
    expect(returns).toEqual([]);
    expect(wastes).toEqual([
      expect.objectContaining({
        orderLineId: LINE_ID,
        productId: "menu_product_soup",
        portions: 1,
        generation: GENERATION,
        actorId: WAITER_ID,
        reason: REASON,
        variantIds: [],
        modifierIds: [],
      }),
    ]);
    expect(wastes[0]).not.toHaveProperty("recipeVersion");
    expect(audits.commands[0]).toMatchObject({
      actorId: WAITER_ID,
      action: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      reason: REASON,
      after: { kitchen: "after", value: 12_000, shiftId: SHIFT_ID },
    });
  }
});

it("given a held line and sale consumption on, when the waiter voids it, then the ledger is not called", async () => {
  const { sale, returns, wastes } = recordingReversal(true);
  const { dining, voidLine } = await harness(
    openCheck("held"),
    withinCap,
    sale,
  );

  await voidLine.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  expect(lineState(stored, LINE_ID)).toBeNull();
  expect(returns).toEqual([]);
  expect(wastes).toEqual([]);
});

it("given sale consumption off, when a sent line or a started line is voided, then the inventory port is skipped", async () => {
  const sent = recordingReversal(false);
  const sentHarness = await harness(openCheck("sent"), withinCap, sent.sale);

  await sentHarness.voidLine.execute(command());

  const sentStored = await sentHarness.dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    CHECK_ID,
  );

  expect(lineState(sentStored, LINE_ID)).toBeNull();
  expect(sent.returns).toEqual([]);
  expect(sent.wastes).toEqual([]);

  const started = recordingReversal(false);
  const startedHarness = await harness(
    openCheck("in_preparation"),
    withinCap,
    started.sale,
  );

  await startedHarness.voidLine.execute(command());

  const startedStored = await startedHarness.dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    CHECK_ID,
  );

  expect(lineState(startedStored, LINE_ID)).toBeNull();
  expect(lineState(startedStored, OTHER_LINE_ID)).toBe("held");
  expect(startedHarness.permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
    value: 12_000,
  });
  expect(startedHarness.steps).toEqual(["count", "evaluate", "save", "audit"]);
  expect(startedHarness.audits.commands[0]).toMatchObject({
    action: PERMISSION.SALE_VOID_AFTER_KITCHEN,
    reason: REASON,
    after: { kitchen: "after", value: 12_000, shiftId: SHIFT_ID },
  });
  expect(started.returns).toEqual([]);
  expect(started.wastes).toEqual([]);
});
