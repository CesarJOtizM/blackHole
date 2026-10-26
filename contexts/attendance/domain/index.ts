export const layer = "domain" as const;

export type {
  HoursCorrection,
  HoursEntry,
  HoursProjection,
  ProjectHoursInput,
  ScheduledShift,
  WorkMode,
} from "#domain/project-hours.js";
export { projectHours } from "#domain/project-hours.js";
export type {
  ClockKind,
  ClockMark,
  ClockPresence,
  ShiftState,
} from "#domain/worker-shift.js";
export {
  SecondClockIn,
  ShiftTransitionRejected,
  WorkerShift,
} from "#domain/worker-shift.js";
