import type { EvaluatePermission } from "#application/evaluate-permission/evaluate-permission.js";
import type {
  AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const FAILED_PIN_ACTION = "pin.confirmation-failed";
const DRAWER_OPENED = "cash.drawer-opened";

export interface ReadControlReportQuery {
  tenantId: string;
  sessionId: string;
  siteId: string;
}

export interface VoidReportRow {
  userId: string;
  authorizerId: string | null;
  reason: string;
  moment: "before kitchen" | "after kitchen";
}

export interface ValueReportRow {
  userId: string;
  authorizerId: string | null;
  value: number;
}

export interface CashDifferenceReportRow {
  cashierId: string;
  shiftId: string;
}

export interface UserReportRow {
  userId: string;
}

export interface AccountChangeReportRow {
  userId: string;
  kind: "reopened" | "edited-after-pre-bill";
}

export interface ControlReport {
  voids: readonly VoidReportRow[];
  discounts: readonly ValueReportRow[];
  courtesies: readonly ValueReportRow[];
  cashDifferences: readonly CashDifferenceReportRow[];
  drawerOpenings: readonly UserReportRow[];
  reopenedOrEditedAfterPreBill: readonly AccountChangeReportRow[];
}

interface ExecutedOperation {
  value: number;
  shiftId: string;
  kitchen: "before" | "after" | null;
}

interface ReportDraft {
  voids: VoidReportRow[];
  discounts: ValueReportRow[];
  courtesies: ValueReportRow[];
  cashDifferences: CashDifferenceReportRow[];
  drawerOpenings: UserReportRow[];
  reopenedOrEditedAfterPreBill: AccountChangeReportRow[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameState = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before) === JSON.stringify(after);

const executedOperation = (after: unknown): ExecutedOperation | null => {
  if (!isRecord(after)) {
    return null;
  }

  const { value, shiftId, kitchen } = after;

  if (
    typeof value !== "number" ||
    typeof shiftId !== "string" ||
    (kitchen !== "before" && kitchen !== "after" && kitchen !== null)
  ) {
    return null;
  }

  return { value, shiftId, kitchen };
};

const deniedDecision = (after: unknown): boolean =>
  isRecord(after) && after.approved === false;

const emptyReport = (): ReportDraft => ({
  voids: [],
  discounts: [],
  courtesies: [],
  cashDifferences: [],
  drawerOpenings: [],
  reopenedOrEditedAfterPreBill: [],
});

const voidMoment = (
  action: string,
  kitchen: ExecutedOperation["kitchen"],
): VoidReportRow["moment"] | null => {
  if (action === PERMISSION.SALE_VOID_BEFORE_KITCHEN && kitchen === "before") {
    return "before kitchen";
  }

  if (action === PERMISSION.SALE_VOID_AFTER_KITCHEN && kitchen === "after") {
    return "after kitchen";
  }

  return null;
};

const successfulOperation = (
  event: AuditEvent,
  siteId: string,
): ExecutedOperation | null => {
  if (
    event.kind !== "event" ||
    event.siteId !== siteId ||
    event.action === FAILED_PIN_ACTION ||
    deniedDecision(event.after)
  ) {
    return null;
  }

  const operation = executedOperation(event.after);

  if (operation === null || sameState(event.before, event.after)) {
    return null;
  }

  return operation;
};

const valueRow = (event: AuditEvent, value: number): ValueReportRow => ({
  userId: event.actorId,
  authorizerId: event.authorizerId,
  value,
});

const appendRow = (
  report: ReportDraft,
  event: AuditEvent,
  operation: ExecutedOperation,
): void => {
  const moment = voidMoment(event.action, operation.kitchen);

  if (moment !== null) {
    report.voids.push({
      userId: event.actorId,
      authorizerId: event.authorizerId,
      reason: event.reason,
      moment,
    });
    return;
  }

  if (event.action === PERMISSION.SALE_DISCOUNT) {
    report.discounts.push(valueRow(event, operation.value));
    return;
  }

  if (event.action === PERMISSION.SALE_COMP) {
    report.courtesies.push(valueRow(event, operation.value));
    return;
  }

  if (event.action === PERMISSION.CASH_APPROVE_VARIANCE) {
    report.cashDifferences.push({
      cashierId: event.actorId,
      shiftId: operation.shiftId,
    });
    return;
  }

  if (event.action === DRAWER_OPENED) {
    report.drawerOpenings.push({ userId: event.actorId });
    return;
  }

  if (event.action === PERMISSION.SALE_REOPEN_PAID) {
    report.reopenedOrEditedAfterPreBill.push({
      userId: event.actorId,
      kind: "reopened",
    });
    return;
  }

  if (event.action === PERMISSION.SALE_EDIT_PRINTED_CHECK) {
    report.reopenedOrEditedAfterPreBill.push({
      userId: event.actorId,
      kind: "edited-after-pre-bill",
    });
  }
};

const project = (
  events: readonly AuditEvent[],
  siteId: string,
): ControlReport => {
  const report = emptyReport();

  for (const event of events) {
    const operation = successfulOperation(event, siteId);

    if (operation === null) {
      continue;
    }

    appendRow(report, event, operation);
  }

  return report;
};

export class ReadControlReport {
  constructor(
    private readonly audits: AuditRepository,
    private readonly permissions: EvaluatePermission,
  ) {}

  async execute(query: ReadControlReportQuery): Promise<ControlReport> {
    const decision = await this.permissions.execute({
      tenantId: query.tenantId,
      sessionId: query.sessionId,
      permission: PERMISSION.AUDIT_VIEW,
      target: { kind: "site", id: query.siteId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      return emptyReport();
    }

    const stored = await this.audits.list(query.tenantId, null);

    return project(stored, query.siteId);
  }
}
