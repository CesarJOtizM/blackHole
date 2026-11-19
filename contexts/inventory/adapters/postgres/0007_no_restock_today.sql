-- Not restocked today. Expiry is not stored: a later America/Bogota
-- date reads expired from a confirmed service_date. No stock movement.
-- No backfill. No SQLite. inventory_app is created in 0001_recipe_catalog.sql.

CREATE TABLE no_restock_today (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  product_id text NOT NULL,
  status text NOT NULL,
  actor_id text,
  service_date text,
  PRIMARY KEY (tenant_id, venue_id, product_id),
  CONSTRAINT no_restock_today_status CHECK (
    status IN ('proposed', 'confirmed', 'removed')
  ),
  CONSTRAINT no_restock_today_stamp CHECK (
    (
      status = 'proposed'
      AND actor_id IS NULL
      AND service_date IS NULL
    )
    OR (
      status IN ('confirmed', 'removed')
      AND actor_id IS NOT NULL
      AND service_date IS NOT NULL
    )
  )
);

ALTER TABLE no_restock_today ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_restock_today FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON no_restock_today
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON no_restock_today TO inventory_app;
