import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import type {
  Printer,
  QueuedSaleReceipt,
  TipsSettlementJob,
} from "#application/ports/printer.js";
import type {
  ClosedTipSettlement,
  TipSettlementStore,
} from "#application/settle-tips/settle-tips.js";
import type { TipSettlementRuleSnapshot } from "#domain/tip-settlement.js";
import {
  MissingTipSettlement,
  TipSettlements,
} from "#domain/tip-settlement.js";

const EMPTY_SHIFT = { waiterVoidsBeforeKitchen: 0 };
const BACKUP_WARNING = "Printed on the backup printer.";
const QUEUED_WARNING = "The print job stayed queued.";
const FAILED_WARNING = "The print job failed.";

export interface PrintTipSettlementCommand {
  tenantId: string;
  venueId: string;
  sessionId: string;
  settlementId: string;
  printerId: string;
  commandId: string;
  period: string;
}

export interface PrintedTipSettlement {
  settlementId: string;
  status: "printed" | "backup" | "queued" | "failed";
  warning: string | null;
}

const assertSettlementId = (id: string): void => {
  TipSettlements.empty().close({
    id,
    poolCop: 0,
    participants: [],
    shares: [],
    residueCop: 0,
    rule: { mode: "equal", shares: [] },
  });
};

const ruleLabel = (rule: TipSettlementRuleSnapshot): string => {
  if (rule.mode !== "percentage") {
    return rule.mode;
  }

  const rows = rule.shares.map(
    (share) => `${share.employeeId} ${share.percent}`,
  );

  return rows.length === 0 ? rule.mode : `${rule.mode} ${rows.join(", ")}`;
};

const jobFor = (
  command: PrintTipSettlementCommand,
  row: ClosedTipSettlement,
): TipsSettlementJob => ({
  commandId: command.commandId,
  printerId: command.printerId,
  document: "tips_settlement",
  kickDrawer: false,
  settlementId: row.id,
  period: command.period,
  methods: row.methods.map((method) => ({
    method: method.method,
    amountCop: method.amountCop,
  })),
  rule: ruleLabel(row.rule),
  residueCop: row.residueCop,
  shares: row.shares.map((share) => ({
    userId: share.userId,
    amountCop: share.baseCop + share.residueCop,
  })),
  poolCop: row.poolCop,
});

const outcomeOf = (
  queued: QueuedSaleReceipt,
  printerId: string,
): Pick<PrintedTipSettlement, "status" | "warning"> => {
  const delivered = queued.deliveredPrinterId;

  if (
    queued.status === "printed" &&
    delivered !== undefined &&
    delivered !== null &&
    delivered !== printerId
  ) {
    return { status: "backup", warning: BACKUP_WARNING };
  }

  if (queued.status === "waiting") {
    return { status: "queued", warning: QUEUED_WARNING };
  }

  if (queued.status === "failed") {
    return { status: "failed", warning: FAILED_WARNING };
  }

  return { status: "printed", warning: null };
};

export class PrintTipSettlement {
  constructor(
    private readonly settlements: TipSettlementStore,
    private readonly permissions: EvaluatePermission,
    private readonly printer: Printer,
  ) {}

  async execute(
    command: PrintTipSettlementCommand,
  ): Promise<PrintedTipSettlement | null> {
    const decision = await this.permissions.execute({
      tenantId: command.tenantId,
      sessionId: command.sessionId,
      permission: PERMISSION.CASH_SETTLE_TIPS,
      target: { kind: "site", id: command.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: EMPTY_SHIFT,
    });

    if (decision.outcome !== "allowed") {
      return null;
    }

    assertSettlementId(command.settlementId);

    const stored = await this.settlements.list(
      command.tenantId,
      command.venueId,
    );
    const row = stored.find((item) => item.id === command.settlementId);

    if (row === undefined) {
      throw new MissingTipSettlement();
    }

    const queued = await this.printer.enqueue(jobFor(command, row));

    return {
      settlementId: row.id,
      ...outcomeOf(queued, command.printerId),
    };
  }
}
