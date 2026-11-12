export const REPORT_PERMISSION = {
  VIEW_SALES: "report.view-sales",
  VIEW_EXPECTED_TOTAL: "cash.view-expected-total",
} as const;

export type ReportPermission =
  (typeof REPORT_PERMISSION)[keyof typeof REPORT_PERMISSION];

export interface ReportAccessQuery {
  tenantId: string;
  actorId: string;
  venueId: string;
  permission: ReportPermission;
}

export interface ReportAccess {
  allows(input: ReportAccessQuery): Promise<boolean>;
}

export interface CashShiftWindow {
  shiftId: string;
  openedAt: string;
  closedAt: string | null;
}

export interface OpenShiftBounds {
  findOpen(tenantId: string, venueId: string): Promise<CashShiftWindow | null>;
}
