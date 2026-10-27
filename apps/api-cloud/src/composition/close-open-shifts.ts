import { InMemoryClockEntryRepository } from "@blackhole/attendance/adapters/memory/in-memory-clock-entry-repository";
import {
  CloseOpenShifts,
  type CloseOpenShiftsCommand,
} from "@blackhole/attendance/application/close-open-shifts";
import { Clock as AttendanceClock } from "@blackhole/attendance/application/ports/clock";
import type { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import type { PgBoss } from "pg-boss";

export const CLOSE_OPEN_SHIFTS_QUEUE = "attendance.close-open-shifts";

export class SystemAttendanceClock extends AttendanceClock {
  override now(): number {
    return Date.now();
  }
}

export const registerCloseOpenShifts = async (
  boss: PgBoss,
  clock: AttendanceClock = new SystemAttendanceClock(),
  entries: ClockEntryRepository = new InMemoryClockEntryRepository(),
): Promise<void> => {
  const close = new CloseOpenShifts(clock, entries);

  await boss.createQueue(CLOSE_OPEN_SHIFTS_QUEUE, { retryLimit: 0 });
  await boss.work<CloseOpenShiftsCommand>(
    CLOSE_OPEN_SHIFTS_QUEUE,
    async (jobs) => {
      for (const job of jobs) {
        await close.execute(job.data);
      }
    },
  );
};
