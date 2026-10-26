import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";

export const clockEntries = pgTable(
  "clock_entries",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    kind: text("kind").notNull(),
    presence: text("presence").notNull(),
    occurredAt: text("occurred_at").notNull(),
    commandId: text("command_id").notNull(),
    cashRegisterId: text("cash_register_id"),
    pendingReview: boolean("pending_review").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("clock_entries_command").on(table.tenantId, table.commandId),
  ],
);

export const attendancePolicies = pgTable(
  "attendance_policies",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    position: integer("position").notNull(),
    geofenceLatitude: doublePrecision("geofence_latitude"),
    geofenceLongitude: doublePrecision("geofence_longitude"),
    geofenceRadiusMeters: integer("geofence_radius_meters"),
    toleranceMinutes: integer("tolerance_minutes").notNull(),
    closeTime: text("close_time").notNull(),
    operationRuleEnabled: boolean("operation_rule_enabled").notNull(),
    mode: text("mode").notNull(),
    scheduleStartsAt: text("schedule_starts_at"),
    scheduleEndsAt: text("schedule_ends_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.venueId, table.position],
    }),
  ],
);
