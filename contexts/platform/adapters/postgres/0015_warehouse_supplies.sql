-- Which warehouses supply a venue. No backfill.
-- organization_app is created in 0002_organization.sql.

CREATE TABLE warehouse_supplies (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  warehouse_location_id text NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, warehouse_location_id)
);

ALTER TABLE warehouse_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_supplies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON warehouse_supplies
  FOR ALL
  TO organization_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON warehouse_supplies TO organization_app;
