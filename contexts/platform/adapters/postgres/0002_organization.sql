CREATE ROLE organization_app;

CREATE TABLE organizations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  CONSTRAINT organizations_tenant CHECK (id = tenant_id)
);

CREATE TABLE taxpayers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  company_id text NOT NULL,
  nit text NOT NULL,
  tax_profile_id text NOT NULL,
  position integer NOT NULL,
  CONSTRAINT taxpayers_company_id_nit UNIQUE (company_id, nit)
);

CREATE TABLE brands (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  company_id text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE venues (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  company_id text NOT NULL,
  name text NOT NULL,
  brand_id text NOT NULL,
  invoicing_taxpayer_id text NOT NULL,
  mode text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE inventory_locations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  company_id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  venue_id text,
  position integer NOT NULL
);

CREATE UNIQUE INDEX inventory_locations_one_point_per_venue
  ON inventory_locations (venue_id)
  WHERE kind = 'point';

CREATE TABLE kitchen_stations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE cash_registers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE organization_changes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  position integer NOT NULL,
  actor_id text NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON taxpayers
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON brands
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON venues
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_locations
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kitchen_stations
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_registers
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE organization_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_changes
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations,
  taxpayers,
  brands,
  venues,
  inventory_locations,
  kitchen_stations,
  cash_registers,
  organization_changes
TO organization_app;
