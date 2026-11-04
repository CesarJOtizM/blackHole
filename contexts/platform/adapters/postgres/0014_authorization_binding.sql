ALTER TABLE authorization_requests
  ADD COLUMN target_id text,
  ADD COLUMN consumed_at bigint;

UPDATE authorization_requests
  SET target_id = venue_id
  WHERE target_id IS NULL;

ALTER TABLE authorization_requests
  ALTER COLUMN target_id SET NOT NULL;

CREATE TABLE authorization_venue_thresholds (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  discount integer NOT NULL DEFAULT 5,
  requester_authorizer_pair integer NOT NULL DEFAULT 5,
  failed_pin integer NOT NULL DEFAULT 5,
  position integer NOT NULL
);

CREATE TABLE authorization_alerts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  kind text NOT NULL,
  shift_id text NOT NULL,
  occurred_at bigint NOT NULL,
  position integer NOT NULL
);

ALTER TABLE authorization_venue_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_venue_thresholds FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_venue_thresholds
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_alerts
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON authorization_venue_thresholds TO authorization_app;

GRANT SELECT, INSERT ON authorization_alerts TO authorization_app;

CREATE FUNCTION authorization_alerts_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'authorization alerts are insert-only';
END;
$$;

CREATE TRIGGER authorization_alerts_reject_update
  BEFORE UPDATE ON authorization_alerts
  FOR EACH ROW
  EXECUTE FUNCTION authorization_alerts_reject_mutation();

CREATE TRIGGER authorization_alerts_reject_delete
  BEFORE DELETE ON authorization_alerts
  FOR EACH ROW
  EXECUTE FUNCTION authorization_alerts_reject_mutation();

CREATE TRIGGER authorization_alerts_reject_truncate
  BEFORE TRUNCATE ON authorization_alerts
  FOR EACH STATEMENT
  EXECUTE FUNCTION authorization_alerts_reject_mutation();
