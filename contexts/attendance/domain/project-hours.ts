import type { ClockKind, ClockPresence } from "#domain/worker-shift.js";

const MINUTE_MS = 60_000;

export interface HoursEntry {
  id: string;
  kind: ClockKind;
  presence: ClockPresence;
  occurredAt: string;
}

export interface HoursCorrection {
  entryId: string;
  occurredAt: string;
  reason: string;
}

export interface ScheduledShift {
  startsAt: string;
  endsAt: string;
}

export type WorkMode = "hours_only" | "scheduled";

interface HoursSource {
  entries: readonly HoursEntry[];
  corrections: readonly HoursCorrection[];
  toleranceMinutes: number;
}

export type ProjectHoursInput =
  | (HoursSource & { mode: "hours_only" })
  | (HoursSource & { mode: "scheduled"; schedule: ScheduledShift });

export interface HoursProjection {
  workedMinutes: number;
  latenessMinutes: number;
  earlyLeaveMinutes: number;
  offScheduleMinutes: number;
  absent: boolean;
}

interface Mark {
  kind: ClockKind;
  at: number;
}

interface Span {
  start: number;
  end: number;
}

const atMinute = (occurredAt: string): number =>
  Math.trunc(Date.parse(occurredAt) / MINUTE_MS);

const resolveMarks = (
  entries: readonly HoursEntry[],
  corrections: readonly HoursCorrection[],
): Mark[] => {
  const replacedAt = new Map<string, string>();

  for (const correction of corrections) {
    replacedAt.set(correction.entryId, correction.occurredAt);
  }

  return entries
    .filter((row) => row.presence !== "flagged")
    .map((row) => ({
      kind: row.kind,
      at: atMinute(replacedAt.get(row.id) ?? row.occurredAt),
    }))
    .sort((left, right) => left.at - right.at);
};

const workSpans = (marks: readonly Mark[]): Span[] => {
  const spans: Span[] = [];
  let openAt: number | null = null;
  let breakAt: number | null = null;

  for (const mark of marks) {
    if (mark.kind === "clock_in") {
      openAt = mark.at;
      breakAt = null;
      continue;
    }
    if (openAt === null) {
      continue;
    }
    if (mark.kind === "break_start" && breakAt === null) {
      spans.push({ start: openAt, end: mark.at });
      breakAt = mark.at;
      continue;
    }
    if (mark.kind === "break_end" && breakAt !== null) {
      openAt = mark.at;
      breakAt = null;
      continue;
    }
    if (mark.kind === "clock_out" && breakAt === null) {
      spans.push({ start: openAt, end: mark.at });
      openAt = null;
    }
  }

  return spans.filter((span) => span.end > span.start);
};

const sumSpans = (spans: readonly Span[]): number =>
  spans.reduce((total, span) => total + (span.end - span.start), 0);

const minutesPast = (delay: number, toleranceMinutes: number): number =>
  delay > toleranceMinutes ? delay : 0;

const latenessMinutes = (
  marks: readonly Mark[],
  schedule: ScheduledShift,
  toleranceMinutes: number,
): number => {
  const clockIn = marks.find((mark) => mark.kind === "clock_in");

  if (!clockIn) {
    return 0;
  }

  return minutesPast(
    clockIn.at - atMinute(schedule.startsAt),
    toleranceMinutes,
  );
};

const earlyLeaveMinutes = (
  marks: readonly Mark[],
  schedule: ScheduledShift,
  toleranceMinutes: number,
): number => {
  const clockOut = marks.findLast((mark) => mark.kind === "clock_out");

  if (!clockOut) {
    return 0;
  }

  return minutesPast(atMinute(schedule.endsAt) - clockOut.at, toleranceMinutes);
};

const offScheduleMinutes = (
  spans: readonly Span[],
  schedule: ScheduledShift,
  toleranceMinutes: number,
): number => {
  const windowStart = atMinute(schedule.startsAt) - toleranceMinutes;
  const windowEnd = atMinute(schedule.endsAt) + toleranceMinutes;
  let outside = 0;

  for (const span of spans) {
    const beforeEnd = Math.min(span.end, windowStart);
    const afterStart = Math.max(span.start, windowEnd);
    outside += Math.max(0, beforeEnd - span.start);
    outside += Math.max(0, span.end - afterStart);
  }

  return outside;
};

const hoursOnly = (workedMinutes: number): HoursProjection => ({
  workedMinutes,
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  offScheduleMinutes: 0,
  absent: false,
});

export const projectHours = (input: ProjectHoursInput): HoursProjection => {
  const marks = resolveMarks(input.entries, input.corrections);
  const spans = workSpans(marks);
  const workedMinutes = sumSpans(spans);

  if (input.mode === "hours_only") {
    return hoursOnly(workedMinutes);
  }

  return {
    workedMinutes,
    latenessMinutes: latenessMinutes(
      marks,
      input.schedule,
      input.toleranceMinutes,
    ),
    earlyLeaveMinutes: earlyLeaveMinutes(
      marks,
      input.schedule,
      input.toleranceMinutes,
    ),
    offScheduleMinutes: offScheduleMinutes(
      spans,
      input.schedule,
      input.toleranceMinutes,
    ),
    absent: !marks.some((mark) => mark.kind === "clock_in"),
  };
};
