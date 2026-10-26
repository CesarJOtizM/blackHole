import { expect, it } from "vitest";

import {
  type HoursCorrection,
  type HoursEntry,
  projectHours,
} from "#domain/project-hours.js";

const IN_AT = "2026-10-23T13:00:00.000Z";
const BREAK_START_AT = "2026-10-23T17:00:00.000Z";
const BREAK_END_AT = "2026-10-23T17:30:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";
const WITHIN_TOLERANCE_AT = "2026-10-23T13:07:00.000Z";
const LATE_AT = "2026-10-23T13:25:00.000Z";
const EARLY_OUT_AT = "2026-10-23T20:40:00.000Z";
const EARLY_IN_AT = "2026-10-23T12:00:00.000Z";
const AUTO_CLOSE_AT = "2026-10-24T03:00:00.000Z";
const FIRST_CORRECTION_AT = "2026-10-23T23:00:00.000Z";
const SCHEDULE = { startsAt: IN_AT, endsAt: OUT_AT };
const NONE = {
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  offScheduleMinutes: 0,
  absent: false,
};

const entry = (
  id: string,
  kind: HoursEntry["kind"],
  occurredAt: string,
  presence: HoursEntry["presence"] = "matched",
): HoursEntry => ({ id, kind, presence, occurredAt });

const hoursOnly = (
  entries: readonly HoursEntry[],
  corrections: readonly HoursCorrection[] = [],
) =>
  projectHours({
    mode: "hours_only",
    entries,
    corrections,
    toleranceMinutes: 10,
  });

const scheduled = (entries: readonly HoursEntry[]) =>
  projectHours({
    mode: "scheduled",
    entries,
    corrections: [],
    toleranceMinutes: 10,
    schedule: SCHEDULE,
  });

const day = [
  entry("attendance_entry_in", "clock_in", IN_AT),
  entry("attendance_entry_break_start", "break_start", BREAK_START_AT),
  entry("attendance_entry_break_end", "break_end", BREAK_END_AT),
  entry("attendance_entry_out", "clock_out", OUT_AT),
];

it("given 08:00 in, a break from 12:00 to 12:30, and 16:00 out, when hours are projected, then worked time is 7h30 and lateness is not reported", () => {
  const projection = hoursOnly(day);

  expect(projection).toEqual({ workedMinutes: 7 * 60 + 30, ...NONE });
});

it("given an 08:00 schedule and a 10-minute tolerance, when the worker clocks in at 08:07, then lateness is not reported", () => {
  const projection = scheduled([
    entry("attendance_entry_in", "clock_in", WITHIN_TOLERANCE_AT),
    entry("attendance_entry_out", "clock_out", OUT_AT),
  ]);

  expect(projection).toEqual({ workedMinutes: 7 * 60 + 53, ...NONE });
});

it("given an auto-closed clock-out, when a later correction replaces its time, then the projection uses the correction and the original row stays", () => {
  const clockOut = entry("attendance_entry_out", "clock_out", AUTO_CLOSE_AT);
  const entries = [entry("attendance_entry_in", "clock_in", IN_AT), clockOut];
  const originalRows = entries.map((row) => ({ ...row }));

  const projection = hoursOnly(entries, [
    {
      entryId: clockOut.id,
      occurredAt: FIRST_CORRECTION_AT,
      reason: "First estimate of the forgotten clock-out",
    },
    {
      entryId: clockOut.id,
      occurredAt: OUT_AT,
      reason: "Worker forgot to clock out",
    },
  ]);

  expect(projection).toEqual({ workedMinutes: 8 * 60, ...NONE });
  expect(entries.map((row) => ({ ...row }))).toEqual(originalRows);
});

it("given an 08:00 schedule and a 10-minute tolerance, when the worker clocks in at 08:25, then lateness is 25 minutes", () => {
  const projection = scheduled([
    entry("attendance_entry_in", "clock_in", LATE_AT),
    entry("attendance_entry_out", "clock_out", OUT_AT),
  ]);

  expect(projection).toEqual({
    workedMinutes: 7 * 60 + 35,
    ...NONE,
    latenessMinutes: 25,
  });
});

it("given a scheduled shift and no matched clock-in, when hours are projected, then the worker is absent", () => {
  const projection = scheduled([]);

  expect(projection).toEqual({ workedMinutes: 0, ...NONE, absent: true });
});

it("given a 16:00 scheduled end and a 10-minute tolerance, when the worker clocks out at 15:40, then early leave is 20 minutes", () => {
  const projection = scheduled([
    entry("attendance_entry_in", "clock_in", IN_AT),
    entry("attendance_entry_out", "clock_out", EARLY_OUT_AT),
  ]);

  expect(projection).toEqual({
    workedMinutes: 7 * 60 + 40,
    ...NONE,
    earlyLeaveMinutes: 20,
  });
});

it("given an 08:00 to 16:00 schedule and a 10-minute tolerance, when the worker clocks in at 07:00, then off-schedule time is 50 minutes", () => {
  const projection = scheduled([
    entry("attendance_entry_in", "clock_in", EARLY_IN_AT),
    entry("attendance_entry_out", "clock_out", OUT_AT),
  ]);

  expect(projection).toEqual({
    workedMinutes: 9 * 60,
    ...NONE,
    offScheduleMinutes: 50,
  });
});

it("given only flagged marks on a scheduled shift, when hours are projected, then those marks add no hours and the worker is absent", () => {
  const projection = scheduled([
    entry("attendance_entry_in", "clock_in", IN_AT, "flagged"),
    entry("attendance_entry_out", "clock_out", OUT_AT, "flagged"),
  ]);

  expect(projection).toEqual({ workedMinutes: 0, ...NONE, absent: true });
});
