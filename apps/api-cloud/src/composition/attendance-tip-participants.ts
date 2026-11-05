import { ListTipParticipants } from "@blackhole/attendance/application/entry-port";
import type { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import type { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import type { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import {
  type TipParticipant,
  type TipParticipantQuery,
  TipParticipantSource,
} from "@blackhole/cash-register/application/entry-port";

export class AttendanceTipParticipants extends TipParticipantSource {
  private readonly listed: ListTipParticipants;

  constructor(
    entries: ClockEntryRepository,
    corrections: ClockEntryCorrectionRepository,
    policies: AttendancePolicyRepository,
  ) {
    super();
    this.listed = new ListTipParticipants(entries, corrections, policies);
  }

  override list(
    query: TipParticipantQuery,
  ): Promise<readonly TipParticipant[]> {
    return this.listed.execute(query);
  }
}
