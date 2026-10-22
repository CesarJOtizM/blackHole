CREATE ROLE identity_app;

CREATE TABLE users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  pin_hash text NOT NULL,
  factor_hash text,
  failed_factor_attempts integer NOT NULL,
  active boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE devices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  kind text NOT NULL,
  station_id text,
  public_key text NOT NULL,
  display_name text NOT NULL,
  pin_failures integer NOT NULL,
  pin_attempts_locked boolean NOT NULL,
  revoked boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE registration_codes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  code_hash text NOT NULL,
  expires_at bigint NOT NULL,
  failed_redeems integer NOT NULL,
  locked boolean NOT NULL,
  used boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  display_name text NOT NULL,
  device_id text NOT NULL,
  venue_id text NOT NULL,
  kind text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE identity_changes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  position integer NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  FOR ALL
  TO identity_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices
  FOR ALL
  TO identity_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON registration_codes
  FOR ALL
  TO identity_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions
  FOR ALL
  TO identity_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE identity_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity_changes
  FOR ALL
  TO identity_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  users,
  devices,
  registration_codes,
  sessions,
  identity_changes
TO identity_app;
