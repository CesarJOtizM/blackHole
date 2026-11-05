import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { PrintTipSettlement as ListedOnEntryPort } from "#application/entry-port.js";
import { Printer, type SaleReceiptJob } from "#application/ports/printer.js";
import {
  PrintTipSettlement,
  type PrintTipSettlementCommand,
} from "#application/print-tip-settlement/print-tip-settlement.js";
import type { ClosedTipSettlement } from "#application/settle-tips/settle-tips.js";
import { TipSettlementStore } from "#application/settle-tips/settle-tips.js";
import { MissingTipSettlement } from "#domain/tip-settlement.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const SESSION_ID = "session_manager";
const SETTLEMENT_ID = "settlement_day_2026_03_04";
const COMMAND_ID = "command_print_tips_1";
const PRINTER_ID = "printer_register";
const BACKUP_PRINTER_ID = "printer_backup";
const PERIOD = "2026-03-04";
const COOK = "employee_cook";
const WAITER = "employee_waiter";

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const clone = <T>(value: T): T => structuredClone(value);

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const closedSettlement = (): ClosedTipSettlement => ({
  id: SETTLEMENT_ID,
  poolCop: 10_000,
  methods: [
    { method: "cash", amountCop: 6_000 },
    { method: "card", amountCop: 4_000 },
  ],
  participants: [
    { userId: COOK, workedMinutes: 360 },
    { userId: WAITER, workedMinutes: 0 },
  ],
  shares: [{ userId: COOK, baseCop: 6_000, residueCop: 0 }],
  residueCop: 4_000,
  rule: {
    mode: "percentage",
    shares: [
      { employeeId: COOK, percent: 60 },
      { employeeId: WAITER, percent: 40 },
    ],
  },
  adjustsSettlementId: null,
  edits: [],
});

const command = (
  patch: Partial<PrintTipSettlementCommand> = {},
): PrintTipSettlementCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  sessionId: SESSION_ID,
  settlementId: SETTLEMENT_ID,
  printerId: PRINTER_ID,
  commandId: COMMAND_ID,
  period: PERIOD,
  ...patch,
});

const tipsJob = {
  commandId: COMMAND_ID,
  printerId: PRINTER_ID,
  document: "tips_settlement" as const,
  kickDrawer: false as const,
  settlementId: SETTLEMENT_ID,
  period: PERIOD,
  methods: [
    { method: "cash" as const, amountCop: 6_000 },
    { method: "card" as const, amountCop: 4_000 },
  ],
  rule: "percentage employee_cook 60, employee_waiter 40",
  residueCop: 4_000,
  shares: [{ userId: COOK, amountCop: 6_000 }],
  poolCop: 10_000,
};

class MemorySettlements extends TipSettlementStore {
  readonly rows: ClosedTipSettlement[];

  constructor(
    private readonly steps: string[],
    rows: readonly ClosedTipSettlement[],
  ) {
    super();
    this.rows = rows.map((row) => clone(row));
  }

  override list(): Promise<readonly ClosedTipSettlement[]> {
    this.steps.push("settlements");
    return Promise.resolve(this.rows.map((row) => clone(row)));
  }

  override append(): Promise<void> {
    this.steps.push("append");
    return Promise.resolve();
  }
}

class MemoryPrinter extends Printer {
  readonly jobs: SaleReceiptJob[] = [];

  constructor(
    private readonly steps: string[],
    private readonly receipt: {
      status: "waiting" | "printed" | "failed";
      kickDrawer: boolean;
      deliveredPrinterId?: string | null;
    },
  ) {
    super();
  }

  override enqueue(job: SaleReceiptJob) {
    this.steps.push("enqueue");
    this.jobs.push(job);
    return Promise.resolve(this.receipt);
  }
}

const harness = (
  decision: Decision = allowed(),
  receipt: {
    status: "waiting" | "printed" | "failed";
    kickDrawer: boolean;
    deliveredPrinterId?: string | null;
  } = {
    status: "printed",
    kickDrawer: false,
    deliveredPrinterId: PRINTER_ID,
  },
  rows: readonly ClosedTipSettlement[] = [closedSettlement()],
) => {
  const steps: string[] = [];
  const inputs: PermissionInput[] = [];
  const settlements = new MemorySettlements(steps, rows);
  const printer = new MemoryPrinter(steps, receipt);
  const permissions = {
    execute: (input: PermissionInput) => {
      steps.push("evaluate");
      inputs.push(input);
      return Promise.resolve(decision);
    },
  } as EvaluatePermission;

  return {
    steps,
    inputs,
    settlements,
    printer,
    print: new PrintTipSettlement(settlements, permissions, printer),
  };
};

it("given a closed settlement, when the administrator prints it, then tips_settlement is enqueued once with kickDrawer false", async () => {
  const scene = harness();
  const stored = clone(scene.settlements.rows[0]);

  const printed = await scene.print.execute(command());

  expect(printed).toEqual({
    settlementId: SETTLEMENT_ID,
    status: "printed",
    warning: null,
  });
  expect(scene.printer.jobs).toEqual([tipsJob]);
  expect(scene.inputs[0]).toEqual({
    tenantId: TENANT_ID,
    sessionId: SESSION_ID,
    permission: PERMISSION.CASH_SETTLE_TIPS,
    target: { kind: "site", id: VENUE_ID, brandId: null },
    value: null,
    supportGrantId: null,
    shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  });
  expect(scene.steps).toEqual(["evaluate", "settlements", "enqueue"]);
  expect(scene.settlements.rows[0]).toEqual(stored);
  expect(ListedOnEntryPort).toBe(PrintTipSettlement);
});

it("given cash.settle-tips is denied, when printing is requested, then nothing is enqueued", async () => {
  const scene = harness(denied());

  const printed = await scene.print.execute(command());

  expect(printed).toBeNull();
  expect(scene.printer.jobs).toEqual([]);
  expect(scene.steps).toEqual(["evaluate"]);
});

it("given the main printer is offline, when a backup printer accepts the job, then the screen warns and the drawer stays closed", async () => {
  const scene = harness(allowed(), {
    status: "printed",
    kickDrawer: false,
    deliveredPrinterId: BACKUP_PRINTER_ID,
  });

  const printed = await scene.print.execute(command());

  expect(printed).toEqual({
    settlementId: SETTLEMENT_ID,
    status: "backup",
    warning: "Printed on the backup printer.",
  });
  expect(scene.printer.jobs).toEqual([tipsJob]);
});

it("given the main printer is offline, when the job stays queued, then the screen warns and nothing is marked printed", async () => {
  const scene = harness(allowed(), {
    status: "waiting",
    kickDrawer: false,
  });

  const printed = await scene.print.execute(command());

  expect(printed).toEqual({
    settlementId: SETTLEMENT_ID,
    status: "queued",
    warning: "The print job stayed queued.",
  });
  expect(scene.printer.jobs).toEqual([tipsJob]);
});

it("given the main printer is offline, when the queued job fails, then the screen warns and the drawer stays closed", async () => {
  const scene = harness(allowed(), {
    status: "failed",
    kickDrawer: false,
  });

  const printed = await scene.print.execute(command());

  expect(printed).toEqual({
    settlementId: SETTLEMENT_ID,
    status: "failed",
    warning: "The print job failed.",
  });
  expect(scene.printer.jobs).toEqual([tipsJob]);
  expect(scene.steps).toEqual(["evaluate", "settlements", "enqueue"]);
});

it("given no closed settlement, when printing is requested, then nothing is enqueued", async () => {
  const scene = harness(allowed(), undefined, []);

  await expect(scene.print.execute(command())).rejects.toBeInstanceOf(
    MissingTipSettlement,
  );

  expect(scene.printer.jobs).toEqual([]);
  expect(scene.steps).toEqual(["evaluate", "settlements"]);
});
