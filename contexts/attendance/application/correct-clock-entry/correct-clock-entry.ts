import type { AttendanceAudit } from "#application/ports/attendance-audit.js";
import type {
  ClockEntryCorrection,
  ClockEntryCorrectionRepository,
} from "#application/ports/clock-entry-correction-repository.js";
import type { ClockEntryRepository } from "#application/ports/clock-entry-repository.js";

const ACTION = "attendance.correct";

export class CorrectionReasonRequired extends Error {
  constructor() {
    super("A clock correction requires a reason.");
    this.name = "CorrectionReasonRequired";
  }
}

export class UnknownClockEntry extends Error {
  constructor() {
    super("That clock entry does not exist.");
    this.name = "UnknownClockEntry";
  }
}

export interface CorrectClockEntryCommand {
  tenantId: string;
  venueId: string;
  userId: string;
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  entryId: string;
  occurredAt: string;
  reason: string;
}

export class CorrectClockEntry {
  constructor(
    private readonly entries: ClockEntryRepository,
    private readonly corrections: ClockEntryCorrectionRepository,
    private readonly audits: AttendanceAudit,
  ) {}

  async execute(command: CorrectClockEntryCommand): Promise<void> {
    const reason = command.reason.trim();

    if (reason === "") {
      throw new CorrectionReasonRequired();
    }

    const listed = await this.entries.list({
      tenantId: command.tenantId,
      venueId: command.venueId,
      userId: command.userId,
    });
    const original = listed.find((row) => row.id === command.entryId);

    if (!original) {
      throw new UnknownClockEntry();
    }

    const correction: ClockEntryCorrection = {
      entryId: original.id,
      occurredAt: command.occurredAt,
      reason,
    };

    await this.corrections.appendCorrection(correction);
    await this.audits.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.venueId,
      action: ACTION,
      entity: original.id,
      before: original.occurredAt,
      after: correction.occurredAt,
      reason,
    });
  }
}
