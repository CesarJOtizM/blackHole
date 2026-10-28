import { z } from "zod";

export const clockKind = z.enum([
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
]);

export const clockPresence = z.enum(["matched", "flagged"]);

const minute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const geofence = z.object({
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().positive(),
});

export const recordClockEntryBody = z
  .object({
    pin: z.string().min(1),
    kind: clockKind,
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
    commandId: z.string().min(1),
  })
  .strict();

export type RecordClockEntryBody = z.infer<typeof recordClockEntryBody>;

export const clockEntryRecorded = z.object({
  id: z.string(),
  kind: clockKind,
  presence: clockPresence,
  occurredAt: z.string(),
  cashRegisterId: z.string().nullable(),
});

export type ClockEntryRecorded = z.infer<typeof clockEntryRecorded>;

export const correctClockEntryBody = z
  .object({
    userId: z.string().min(1),
    occurredAt: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export type CorrectClockEntryBody = z.infer<typeof correctClockEntryBody>;

const policyFields = {
  geofence: geofence.nullable(),
  toleranceMinutes: z.number().int().nonnegative(),
  closeTime: minute,
  operationRuleEnabled: z.boolean(),
};

export const attendancePolicyBody = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("hours_only"), ...policyFields }).strict(),
  z
    .object({
      mode: z.literal("scheduled"),
      ...policyFields,
      schedule: z.object({ startsAt: minute, endsAt: minute }).strict(),
    })
    .strict(),
]);

export type AttendancePolicyBody = z.infer<typeof attendancePolicyBody>;

export const exportHoursBody = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .strict();

export type ExportHoursBody = z.infer<typeof exportHoursBody>;

const attendanceCorrection = z.object({
  entryId: z.string(),
  occurredAt: z.string(),
  reason: z.string(),
});

export const attendanceRead = z.object({
  workers: z.array(
    z.object({
      userId: z.string(),
      state: z.enum(["off_shift", "on_shift", "on_break", "pending_review"]),
      workedMinutes: z.number(),
      latenessMinutes: z.number(),
      earlyLeaveMinutes: z.number(),
      offScheduleMinutes: z.number(),
      absent: z.boolean(),
      corrections: z.array(attendanceCorrection),
    }),
  ),
});

export type AttendanceRead = z.infer<typeof attendanceRead>;
