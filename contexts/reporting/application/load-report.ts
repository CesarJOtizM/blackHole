import {
  AuthorizeReport,
  type ReportAuthorization,
  type ReportCommand,
  type ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import type {
  OperationFacts,
  OperationSnapshot,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";

export type LoadedReport =
  | { outcome: "denied"; reason: ReportDenial }
  | {
      outcome: "ready";
      scope: Extract<ReportAuthorization, { outcome: "allowed" }>;
      snapshot: OperationSnapshot;
    };

const scopeWaiter = (
  snapshot: OperationSnapshot,
  waiterId: string | null,
): OperationSnapshot => {
  if (waiterId === null) {
    return snapshot;
  }

  return {
    ...snapshot,
    lines: snapshot.lines.filter((row) => row.waiterId === waiterId),
    tenders: snapshot.tenders.filter((row) => row.waiterId === waiterId),
    staffHours: snapshot.staffHours.filter((row) => row.waiterId === waiterId),
  };
};

export const loadReport = async (
  access: ReportAccess,
  shifts: OpenShiftBounds,
  facts: OperationFacts,
  command: ReportCommand,
): Promise<LoadedReport> => {
  const decision = await new AuthorizeReport(access, shifts).execute(command);

  if (decision.outcome === "denied") {
    return decision;
  }

  const snapshot = await facts.read({
    tenantId: command.tenantId,
    venueId: decision.venueId,
    from: decision.from,
    to: decision.to,
  });

  return {
    outcome: "ready",
    scope: decision,
    snapshot: scopeWaiter(snapshot, decision.waiterId),
  };
};
