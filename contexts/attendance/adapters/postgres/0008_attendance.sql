CREATE ROLE attendance_app;

CREATE TABLE clock_entries (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  user_id text NOT NULL,
  device_id text NOT NULL,
  kind text NOT NULL,
  presence text NOT NULL,
  occurred_at text NOT NULL,
  command_id text NOT NULL,
  cash_register_id text,
  pending_review boolean NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT clock_entries_command UNIQUE (tenant_id, command_id),
  CONSTRAINT clock_entries_kind CHECK (
    kind IN ('clock_in', 'clock_out', 'break_start', 'break_end')
  ),
  CONSTRAINT clock_entries_presence CHECK (
    presence IN ('matched', 'flagged')
  )
);

CREATE TABLE attendance_policies (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  position integer NOT NULL,
  geofence_latitude double precision,
  geofence_longitude double precision,
  geofence_radius_meters integer,
  tolerance_minutes integer NOT NULL,
  close_time text NOT NULL,
  operation_rule_enabled boolean NOT NULL,
  mode text NOT NULL,
  schedule_starts_at text,
  schedule_ends_at text,
  PRIMARY KEY (tenant_id, venue_id, position),
  CONSTRAINT attendance_policies_mode CHECK (
    mode IN ('hours_only', 'scheduled')
  ),
  CONSTRAINT attendance_policies_schedule CHECK (
    (
      mode = 'hours_only'
      AND schedule_starts_at IS NULL
      AND schedule_ends_at IS NULL
    )
    OR (
      mode = 'scheduled'
      AND schedule_starts_at IS NOT NULL
      AND schedule_ends_at IS NOT NULL
    )
  ),
  CONSTRAINT attendance_policies_geofence CHECK (
    (
      geofence_latitude IS NULL
      AND geofence_longitude IS NULL
      AND geofence_radius_meters IS NULL
    )
    OR (
      geofence_latitude IS NOT NULL
      AND geofence_longitude IS NOT NULL
      AND geofence_radius_meters IS NOT NULL
    )
  )
);

ALTER TABLE clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clock_entries
  FOR ALL
  TO attendance_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance_policies
  FOR ALL
  TO attendance_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON clock_entries, attendance_policies TO attendance_app;

CREATE FUNCTION attendance_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'attendance rows are append-only';
END;
$$;

CREATE TRIGGER clock_entries_reject_update
  BEFORE UPDATE ON clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION attendance_reject_mutation();

CREATE TRIGGER clock_entries_reject_delete
  BEFORE DELETE ON clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION attendance_reject_mutation();

CREATE TRIGGER clock_entries_reject_truncate
  BEFORE TRUNCATE ON clock_entries
  FOR EACH STATEMENT
  EXECUTE FUNCTION attendance_reject_mutation();

CREATE TRIGGER attendance_policies_reject_update
  BEFORE UPDATE ON attendance_policies
  FOR EACH ROW
  EXECUTE FUNCTION attendance_reject_mutation();

CREATE TRIGGER attendance_policies_reject_delete
  BEFORE DELETE ON attendance_policies
  FOR EACH ROW
  EXECUTE FUNCTION attendance_reject_mutation();

CREATE TRIGGER attendance_policies_reject_truncate
  BEFORE TRUNCATE ON attendance_policies
  FOR EACH STATEMENT
  EXECUTE FUNCTION attendance_reject_mutation();
