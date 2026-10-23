CREATE ROLE audit_app;

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  authorizer_id text,
  device_id text NOT NULL,
  site_id text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text NOT NULL,
  occurred_at bigint NOT NULL,
  sequence integer NOT NULL,
  previous_hash text NOT NULL,
  digest text NOT NULL,
  record_kind text NOT NULL,
  CONSTRAINT audit_events_kind CHECK (
    record_kind IN ('event', 'altered', 'deleted')
  ),
  CONSTRAINT audit_events_device_sequence_kind UNIQUE (
    tenant_id,
    device_id,
    sequence,
    record_kind
  )
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON audit_events
  FOR ALL
  TO audit_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON audit_events TO audit_app;

CREATE FUNCTION audit_events_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$;

CREATE TRIGGER audit_events_reject_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_reject_mutation();

CREATE TRIGGER audit_events_reject_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_events_reject_mutation();

CREATE TRIGGER audit_events_reject_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION audit_events_reject_mutation();
