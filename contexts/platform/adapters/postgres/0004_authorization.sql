CREATE ROLE authorization_app;

CREATE TABLE authorizations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  CONSTRAINT authorizations_tenant CHECK (id = tenant_id)
);

CREATE TABLE authorization_roles (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  source_role_id text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_role_permissions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  role_id text NOT NULL,
  permission text NOT NULL,
  grant_value text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_role_limits (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  role_id text NOT NULL,
  limit_code text NOT NULL,
  cap integer NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_assignments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  role_id text NOT NULL,
  scope_kind text NOT NULL,
  scope_id text NOT NULL,
  valid_from bigint,
  valid_until bigint,
  position integer NOT NULL
);

CREATE TABLE authorization_venue_limits (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  role_id text NOT NULL,
  limit_code text NOT NULL,
  cap integer NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_bartender_flags (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  enabled boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  requester_id text NOT NULL,
  permission text NOT NULL,
  venue_id text NOT NULL,
  value integer,
  reason text NOT NULL,
  expires_at bigint NOT NULL,
  status text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_resolutions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  request_id text NOT NULL,
  requester_id text NOT NULL,
  authorizer_id text NOT NULL,
  action text NOT NULL,
  value integer,
  reason text NOT NULL,
  device_id text NOT NULL,
  occurred_at bigint NOT NULL,
  self_authorized boolean NOT NULL,
  approved boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_support_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  expires_at bigint NOT NULL,
  expired boolean NOT NULL,
  revoked boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_support_actions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  grant_id text NOT NULL,
  actor_id text NOT NULL,
  permission text NOT NULL,
  occurred_at bigint NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_shift_flags (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  shift_id text NOT NULL,
  self_authorization boolean NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_notices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  owner_user_id text NOT NULL,
  kind text NOT NULL,
  occurred_at bigint NOT NULL,
  position integer NOT NULL
);

CREATE TABLE authorization_changes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  position integer NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL
);

ALTER TABLE authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorizations
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_roles
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_role_permissions
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_role_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_role_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_role_limits
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_assignments
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_venue_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_venue_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_venue_limits
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_bartender_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_bartender_flags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_bartender_flags
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_requests
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_resolutions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_resolutions
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_support_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_support_grants
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_support_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_support_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_support_actions
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_shift_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_shift_flags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_shift_flags
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_notices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_notices
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE authorization_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON authorization_changes
  FOR ALL
  TO authorization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  authorizations,
  authorization_roles,
  authorization_role_permissions,
  authorization_role_limits,
  authorization_assignments,
  authorization_venue_limits,
  authorization_bartender_flags,
  authorization_requests,
  authorization_resolutions,
  authorization_support_grants,
  authorization_support_actions,
  authorization_shift_flags,
  authorization_notices,
  authorization_changes
TO authorization_app;
