import {
  AuthorizationAlreadyConsumed,
  type ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";
import { expect, it, vi } from "vitest";

import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import {
  ReassignCheck,
  type ReassignCheckInput,
} from "#application/reassign-check/reassign-check.js";
import { Check, TableNotOpen } from "#domain/check.js";
import { DiningTable, type TableState } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TARGET_TABLE_ID = "table_5";
const SOURCE_TABLE_ID = "table_6";
const TARGET_CHECK_ID = "check_5";
const SOURCE_CHECK_ID = "check_6";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";

interface LineInput {
  orderId: string;
  lineId: string;
  name: string;
  price: number;
}

const STEAK: LineInput = {
  orderId: "order_5",
  lineId: "line_steak",
  name: "Steak",
  price: 15_000,
};

const SOUP: LineInput = {
  orderId: "order_6",
  lineId: "line_soup",
  name: "Soup",
  price: 9_000,
};

const SALAD: LineInput = {
  orderId: "order_6",
  lineId: "line_salad",
  name: "Salad",
  price: 8_000,
};

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly tables = new Map<string, DiningTable>();
  private readonly checks = new Map<string, Check>();

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    return this.tables.get(`${tenantId}:${venueId}:${tableId}`) ?? null;
  }

  override async save(table: DiningTable): Promise<void> {
    this.tables.set(`${table.tenantId}:${table.venueId}:${table.id}`, table);
  }

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
    }
  }
}

const placeTable = (id: string, state: TableState): DiningTable => {
  const table = DiningTable.place({
    id,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  if (state === "free") {
    return table;
  }

  table.open({ diners: 4 });

  if (state === "check_requested") {
    table.requestCheck();
  }

  if (state === "to_clean") {
    table.release();
  }

  return table;
};

const fillCheck = (
  check: Check,
  lines: readonly LineInput[],
  state: "occupied" | "check_requested",
) => {
  for (const line of lines) {
    check.addLine({
      orderId: line.orderId,
      lineId: line.lineId,
      productId: `menu_product_${line.name.toLowerCase()}`,
      name: line.name,
      course: 1,
      price: line.price,
      channel: "waiter",
    });
  }

  check.send({ course: 1, sentAt: SENT_AT });

  if (state === "check_requested") {
    check.requestCheck();
  }
};

const seat = async (input: {
  targetTable: TableState;
  sourceTable: TableState;
  targetCheck?: "occupied" | "check_requested";
  sourceCheck?: "occupied" | "check_requested";
  sourceLines?: readonly LineInput[];
}) => {
  const dining = new MemoryDiningRoom();
  const targetTable = placeTable(TARGET_TABLE_ID, input.targetTable);
  const sourceTable = placeTable(SOURCE_TABLE_ID, input.sourceTable);
  const target = Check.open({
    id: TARGET_CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TARGET_TABLE_ID,
    openedAt: OPENED_AT,
  });
  const source = Check.open({
    id: SOURCE_CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: SOURCE_TABLE_ID,
    openedAt: OPENED_AT,
  });

  fillCheck(target, [STEAK], input.targetCheck ?? "occupied");
  fillCheck(
    source,
    input.sourceLines ?? [SOUP],
    input.sourceCheck ?? "occupied",
  );
  await dining.save(targetTable);
  await dining.save(sourceTable);
  await dining.saveCheck(target);
  await dining.saveCheck(source);

  return {
    dining,
    reassign: new ReassignCheck(dining),
    target,
    source,
  };
};

const linesOf = (check: Check | null | undefined) =>
  check?.orders.flatMap((order) => order.lines) ?? [];

it("given table 6 joined into table 5, when the waiter joins them, then table 5 holds both lines and each originTableId stays", async () => {
  const { dining, reassign } = await seat({
    targetTable: "occupied",
    sourceTable: "check_requested",
    sourceCheck: "check_requested",
  });

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "join",
  });

  const storedTarget = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    TARGET_CHECK_ID,
  );
  const storedSource = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    SOURCE_CHECK_ID,
  );
  expect(storedTarget?.id).toBe(TARGET_CHECK_ID);
  expect(storedSource?.id).toBe(SOURCE_CHECK_ID);
  expect(storedTarget?.tableId).toBe(TARGET_TABLE_ID);
  expect(storedSource?.tableId).toBe(SOURCE_TABLE_ID);
  expect(storedTarget?.tableState).toBe("occupied");
  expect(storedSource?.tableState).toBe("check_requested");
  expect(storedSource?.orders).toEqual([]);
  expect(storedTarget?.total).toBe(24_000);
  expect(linesOf(storedTarget)).toEqual([
    expect.objectContaining({
      id: "line_steak",
      originTableId: TARGET_TABLE_ID,
    }),
    expect.objectContaining({
      id: "line_soup",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
  expect((await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state).toBe(
    "occupied",
  );
  expect((await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state).toBe(
    "check_requested",
  );
});

it("given a transfer, when lines move, then table states stay", async () => {
  const { dining, reassign } = await seat({
    targetTable: "check_requested",
    sourceTable: "occupied",
    targetCheck: "check_requested",
    sourceLines: [SOUP, SALAD],
  });

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "transfer",
    lineIds: ["line_salad"],
  });

  const storedTarget = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    TARGET_CHECK_ID,
  );
  const storedSource = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    SOURCE_CHECK_ID,
  );
  expect(storedTarget?.id).toBe(TARGET_CHECK_ID);
  expect(storedSource?.id).toBe(SOURCE_CHECK_ID);
  expect(storedTarget?.tableId).toBe(TARGET_TABLE_ID);
  expect(storedSource?.tableId).toBe(SOURCE_TABLE_ID);
  expect(storedTarget?.tableState).toBe("check_requested");
  expect(storedSource?.tableState).toBe("occupied");
  expect((await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state).toBe(
    "check_requested",
  );
  expect((await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state).toBe(
    "occupied",
  );
  expect(linesOf(storedTarget)).toEqual([
    expect.objectContaining({
      id: "line_steak",
      originTableId: TARGET_TABLE_ID,
    }),
    expect.objectContaining({
      id: "line_salad",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
  expect(linesOf(storedSource)).toEqual([
    expect.objectContaining({
      id: "line_soup",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
});

it("given a to_clean or free table, when lines are reassigned, then TableNotOpen and nothing is saved", async () => {
  const cases = [
    {
      targetTable: "occupied",
      sourceTable: "free",
      kind: "join",
    },
    {
      targetTable: "to_clean",
      sourceTable: "occupied",
      kind: "join",
    },
    {
      targetTable: "free",
      sourceTable: "check_requested",
      kind: "transfer",
    },
    {
      targetTable: "check_requested",
      sourceTable: "to_clean",
      kind: "transfer",
    },
  ] as const;

  for (const attempt of cases) {
    const { dining, reassign, target, source } = await seat({
      targetTable: attempt.targetTable,
      sourceTable: attempt.sourceTable,
    });
    const before = {
      target: linesOf(target),
      source: linesOf(source),
    };
    const save = vi.spyOn(dining, "save");
    const saveCheck = vi.spyOn(dining, "saveCheck");
    const saveChecks = vi.spyOn(dining, "saveChecks");

    const reassignLines =
      attempt.kind === "join"
        ? reassign.execute({
            tenantId: TENANT_ID,
            venueId: VENUE_ID,
            targetCheckId: TARGET_CHECK_ID,
            sourceCheckId: SOURCE_CHECK_ID,
            kind: "join",
          })
        : reassign.execute({
            tenantId: TENANT_ID,
            venueId: VENUE_ID,
            targetCheckId: TARGET_CHECK_ID,
            sourceCheckId: SOURCE_CHECK_ID,
            kind: "transfer",
            lineIds: ["line_soup"],
          });

    await expect(reassignLines).rejects.toThrow(TableNotOpen);
    expect(save).not.toHaveBeenCalled();
    expect(saveCheck).not.toHaveBeenCalled();
    expect(saveChecks).not.toHaveBeenCalled();
    expect(
      linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID)),
    ).toEqual(before.target);
    expect(
      linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, SOURCE_CHECK_ID)),
    ).toEqual(before.source);
    expect(
      (await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state,
    ).toBe(attempt.targetTable);
    expect(
      (await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state,
    ).toBe(attempt.sourceTable);
  }
});

it("given a join, when both checks change, then one save covers both checks", async () => {
  const { dining, reassign } = await seat({
    targetTable: "occupied",
    sourceTable: "occupied",
  });
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "join",
  });

  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).toHaveBeenCalledTimes(1);
  const [saved] = saveChecks.mock.calls[0] ?? [];
  expect(saved?.map((check) => check.id)).toEqual([
    TARGET_CHECK_ID,
    SOURCE_CHECK_ID,
  ]);
  expect(
    linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID)),
  ).toHaveLength(2);
  expect(
    (await dining.loadCheck(TENANT_ID, VENUE_ID, SOURCE_CHECK_ID))?.orders,
  ).toEqual([]);
});

const CURRENT_WAITER = "user_current";
const NEW_WAITER = "user_w";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_transfer";
const REASON = "Section change";
const COUNTED = { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 };
const blank = {} as never;

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type CountQuery = { tenantId: string; actorId: string; shiftId: string };
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];
type GrantMode = "match" | "consumed" | "unknown";

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });

const needsGrant = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: null,
  selfAuthorized: false,
});

const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const waiterOf = (check: Check | null | undefined): string | null => {
  const waiterId = (check as { waiterId?: unknown } | null | undefined)
    ?.waiterId;

  return typeof waiterId === "string" ? waiterId : null;
};

const seatWaiter = (check: Check, waiterId: string) => {
  (check as Check & { waiterId: string }).waiterId = waiterId;
};

const transferCommand = (
  authorizationId: string | null = null,
  authorizerId: string | null = null,
): ReassignCheckInput => ({
  kind: "transfer-table",
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: TARGET_CHECK_ID,
  waiterId: NEW_WAITER,
  actorId: SUPERVISOR_ID,
  authorizerId,
  sessionId: "session_supervisor",
  deviceId: "device_floor",
  shiftId: SHIFT_ID,
  reason: REASON,
  authorizationId,
});

const matchingGrant = {
  authorizationId: REQUEST_ID,
  targetId: TARGET_CHECK_ID,
  value: STEAK.price,
};

const consumeCall = {
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.SALE_TRANSFER_TABLE,
  targetId: TARGET_CHECK_ID,
  value: STEAK.price,
};

const transferHarness = async (options: {
  decision?: Decision;
  open?: boolean;
  grant?: StoredGrant | null;
  mode?: GrantMode;
}) => {
  const { dining, target } = await seat({
    targetTable: "occupied",
    sourceTable: "occupied",
  });
  const steps: string[] = [];
  const queries: CountQuery[] = [];
  const inputs: PermissionInput[] = [];
  const calls: ConsumeAuthorizationInput[] = [];
  const commands: AuditCommand[] = [];
  const grant = options.grant === undefined ? matchingGrant : options.grant;
  const mode = options.mode ?? "match";
  const open = options.open ?? true;
  const saveCheck = dining.saveCheck.bind(dining);

  seatWaiter(target, CURRENT_WAITER);
  vi.spyOn(dining, "saveCheck").mockImplementation((check) => {
    steps.push("save");
    return saveCheck(check);
  });

  return {
    dining,
    steps,
    queries,
    inputs,
    calls,
    commands,
    reassign: new ReassignCheck(dining, {
      shifts: { isOpen: () => Promise.resolve(open) } as OpenShiftReader,
      counts: {
        execute(query: CountQuery) {
          steps.push("count");
          queries.push(query);
          return Promise.resolve(COUNTED);
        },
      } as CountExecutedOperations,
      permissions: {
        execute(input: PermissionInput) {
          steps.push("evaluate");
          inputs.push(input);
          return Promise.resolve(options.decision ?? needsGrant());
        },
      } as EvaluatePermission,
      grants: {
        execute(input: ConsumeAuthorizationInput) {
          steps.push("consume");
          calls.push(input);

          if (mode === "consumed") {
            throw new AuthorizationAlreadyConsumed();
          }

          if (mode === "unknown") {
            throw new UnknownAuthorizationReference();
          }

          return Promise.resolve(
            grant !== null &&
              input.authorizationId === grant.authorizationId &&
              input.permission === PERMISSION.SALE_TRANSFER_TABLE &&
              input.targetId === grant.targetId &&
              input.value === grant.value,
          );
        },
      } as ConsumeAuthorization,
      audits: {
        execute(command: AuditCommand) {
          steps.push("audit");
          commands.push(command);
          return Promise.resolve(blank);
        },
      } as unknown as RecordAuditEvent,
    }),
  };
};

const expectCurrentWaiter = async (dining: MemoryDiningRoom) => {
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID);

  expect(waiterOf(stored)).toBe(CURRENT_WAITER);
  expect(stored?.tableId).toBe(TARGET_TABLE_ID);
  expect(linesOf(stored).map((line) => line.id)).toEqual(["line_steak"]);
};

it("given a supervisor allowed to transfer, when she moves table 5 to waiter W, then W owns it and the change is audited", async () => {
  const { dining, steps, queries, inputs, calls, commands, reassign } =
    await transferHarness({ decision: allowed(), grant: null });

  await reassign.execute(transferCommand());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID);
  expect(waiterOf(stored)).toBe(NEW_WAITER);
  expect(stored?.tableId).toBe(TARGET_TABLE_ID);
  expect(linesOf(stored).map((line) => line.id)).toEqual(["line_steak"]);
  expect(calls).toEqual([]);
  expect(queries).toEqual([
    { tenantId: TENANT_ID, actorId: SUPERVISOR_ID, shiftId: SHIFT_ID },
  ]);
  expect(inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_TRANSFER_TABLE,
    value: STEAK.price,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(steps).toEqual(["count", "evaluate", "save", "audit"]);
  expect(commands[0]).toMatchObject({
    actorId: SUPERVISOR_ID,
    authorizerId: null,
    deviceId: "device_floor",
    siteId: VENUE_ID,
    action: PERMISSION.SALE_TRANSFER_TABLE,
    entity: TARGET_CHECK_ID,
    reason: REASON,
    before: { waiterId: CURRENT_WAITER },
    after: {
      value: STEAK.price,
      shiftId: SHIFT_ID,
      kitchen: null,
      waiterId: NEW_WAITER,
    },
  });
  expect(commands[0]?.after).not.toHaveProperty("pin");
});

it("given a transfer that requires authorization, when the grant matches the check, then the grant is consumed before waiter W owns table 5", async () => {
  const { dining, steps, calls, commands, reassign } = await transferHarness({
    decision: needsGrant(),
  });

  await reassign.execute(transferCommand(REQUEST_ID, SUPERVISOR_ID));

  expect(
    waiterOf(await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID)),
  ).toBe(NEW_WAITER);
  expect(calls).toEqual([consumeCall]);
  expect(steps).toEqual(["count", "evaluate", "consume", "save", "audit"]);
  expect(commands[0]?.after).toMatchObject({
    value: STEAK.price,
    shiftId: SHIFT_ID,
    kitchen: null,
    waiterId: NEW_WAITER,
  });
});

it("given a missing grant, a mismatch, a denial, a closed shift, or an unknown authorization, when the supervisor transfers table 5, then the current waiter stays", async () => {
  const stayed = [
    {
      grant: null,
      authorizationId: null,
      calls: [],
      steps: ["count", "evaluate"],
    },
    {
      grant: {
        authorizationId: REQUEST_ID,
        targetId: "check_other",
        value: STEAK.price,
      },
      authorizationId: REQUEST_ID,
      calls: [consumeCall],
      steps: ["count", "evaluate", "consume"],
    },
    {
      grant: {
        authorizationId: REQUEST_ID,
        targetId: TARGET_CHECK_ID,
        value: 1,
      },
      authorizationId: REQUEST_ID,
      calls: [consumeCall],
      steps: ["count", "evaluate", "consume"],
    },
    {
      decision: denied(),
      grant: null,
      authorizationId: null,
      calls: [],
      steps: ["count", "evaluate"],
    },
    {
      open: false,
      authorizationId: REQUEST_ID,
      calls: [],
      steps: [],
    },
    {
      mode: "unknown" as const,
      authorizationId: REQUEST_ID,
      calls: [consumeCall],
      steps: ["count", "evaluate", "consume"],
    },
  ];

  for (const attempt of stayed) {
    const { dining, steps, calls, commands, reassign } =
      await transferHarness(attempt);

    await reassign.execute(transferCommand(attempt.authorizationId));

    await expectCurrentWaiter(dining);
    expect(commands).toEqual([]);
    expect(calls).toEqual(attempt.calls);
    expect(steps).toEqual(attempt.steps);
  }
});

it("given a matching grant that was already consumed, when the supervisor transfers table 5, then the error is raised and the current waiter stays", async () => {
  const { dining, steps, commands, reassign } = await transferHarness({
    decision: needsGrant(),
    mode: "consumed",
  });

  await expect(
    reassign.execute(transferCommand(REQUEST_ID, SUPERVISOR_ID)),
  ).rejects.toBeInstanceOf(AuthorizationAlreadyConsumed);
  await expectCurrentWaiter(dining);
  expect(commands).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "consume"]);
});

it("given the transfer ports are absent, when a supervisor moves table 5 to waiter W, then the current waiter stays", async () => {
  const { dining, reassign, target } = await seat({
    targetTable: "occupied",
    sourceTable: "occupied",
  });
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  seatWaiter(target, CURRENT_WAITER);
  await reassign.execute(transferCommand());

  await expectCurrentWaiter(dining);
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
});
