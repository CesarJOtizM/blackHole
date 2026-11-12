import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { REPORT_PERMISSION } from "#application/ports/report-access.js";

export type ReportRole = "site_administrator" | "supervisor" | "waiter";

export type ReportDenial =
  | "other_venue"
  | "previous_shift"
  | "missing_permission"
  | "other_waiter";

export interface ReportCommand {
  tenantId: string;
  venueId: string;
  actorId: string;
  role: ReportRole;
  homeVenueId: string;
  waiterId: string | null;
  subjectWaiterId: string | null;
  shiftId: string | null;
  from: string;
  to: string;
}

export type ReportAuthorization =
  | {
      outcome: "allowed";
      venueId: string;
      from: string;
      to: string;
      waiterId: string | null;
    }
  | { outcome: "denied"; reason: ReportDenial };

const denied = (reason: ReportDenial): ReportAuthorization => ({
  outcome: "denied",
  reason,
});

const allowed = (
  command: ReportCommand,
  from: string,
  to: string,
  waiterId: string | null,
): ReportAuthorization => ({
  outcome: "allowed",
  venueId: command.venueId,
  from,
  to,
  waiterId,
});

export class AuthorizeReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly shifts: OpenShiftBounds,
  ) {}

  async execute(command: ReportCommand): Promise<ReportAuthorization> {
    if (command.venueId !== command.homeVenueId) {
      return denied("other_venue");
    }

    const permitted = await this.access.allows({
      tenantId: command.tenantId,
      actorId: command.actorId,
      venueId: command.venueId,
      permission: REPORT_PERMISSION.VIEW_SALES,
    });

    if (!permitted) {
      return denied("missing_permission");
    }

    if (command.role === "waiter") {
      return this.waiter(command);
    }

    if (command.role === "supervisor") {
      return this.supervisor(command);
    }

    return allowed(command, command.from, command.to, command.subjectWaiterId);
  }

  private waiter(command: ReportCommand): ReportAuthorization {
    if (
      command.waiterId === null ||
      (command.subjectWaiterId !== null &&
        command.subjectWaiterId !== command.waiterId)
    ) {
      return denied("other_waiter");
    }

    return allowed(command, command.from, command.to, command.waiterId);
  }

  private async supervisor(
    command: ReportCommand,
  ): Promise<ReportAuthorization> {
    const open = await this.shifts.findOpen(command.tenantId, command.venueId);

    if (open === null || command.shiftId !== open.shiftId) {
      return denied("previous_shift");
    }

    const from = command.from < open.openedAt ? open.openedAt : command.from;
    const to =
      open.closedAt !== null && command.to > open.closedAt
        ? open.closedAt
        : command.to;

    if (from >= to) {
      return denied("previous_shift");
    }

    return allowed(command, from, to, command.subjectWaiterId);
  }
}
