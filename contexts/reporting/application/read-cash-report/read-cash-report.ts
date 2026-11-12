import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import { loadReport } from "#application/load-report.js";
import type {
  CashCountFact,
  OperationFacts,
  TenderMethod,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { REPORT_PERMISSION } from "#application/ports/report-access.js";

export interface CashCountRow {
  shiftId: string;
  method: TenderMethod;
  expectedCop: number;
  countedCop: number;
  differenceCop: number;
}

export type CashCounts =
  | { visible: false }
  | { visible: true; rows: readonly CashCountRow[] };

export interface CashReport {
  counts: CashCounts;
}

export type CashReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: CashReport };

const rowsOf = (counts: readonly CashCountFact[]): CashCountRow[] =>
  counts
    .map((count) => ({
      shiftId: count.shiftId,
      method: count.method,
      expectedCop: count.expectedCop,
      countedCop: count.countedCop,
      differenceCop: count.countedCop - count.expectedCop,
    }))
    .sort(
      (left, right) =>
        left.method.localeCompare(right.method) ||
        left.shiftId.localeCompare(right.shiftId),
    );

export class ReadCashReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly shifts: OpenShiftBounds,
    private readonly facts: OperationFacts,
  ) {}

  async execute(command: ReportCommand): Promise<CashReportResult> {
    const loaded = await loadReport(
      this.access,
      this.shifts,
      this.facts,
      command,
    );

    if (loaded.outcome === "denied") {
      return loaded;
    }

    const visible = await this.access.allows({
      tenantId: command.tenantId,
      actorId: command.actorId,
      venueId: command.venueId,
      permission: REPORT_PERMISSION.VIEW_EXPECTED_TOTAL,
    });

    if (!visible) {
      return { outcome: "ready", report: { counts: { visible: false } } };
    }

    return {
      outcome: "ready",
      report: {
        counts: { visible: true, rows: rowsOf(loaded.snapshot.cashCounts) },
      },
    };
  }
}
