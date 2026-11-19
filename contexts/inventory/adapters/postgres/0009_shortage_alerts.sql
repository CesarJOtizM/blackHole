-- Shortage alerts. New tables only. No alert backfill.
-- shortage_alerts_enabled defaults off per venue.
-- One open level, coverage, or dish row per ingredient or dish.
-- inventory_app is created in 0001_recipe_catalog.sql. No SQLite.

CREATE TABLE stock_level_templates (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  ingredient_id text NOT NULL,
  maximum integer NOT NULL,
  reorder_point integer NOT NULL,
  minimum integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, ingredient_id),
  CONSTRAINT stock_level_templates_order CHECK (
    minimum >= 0
    AND reorder_point >= minimum
    AND maximum >= reorder_point
  )
);

CREATE TABLE stock_levels (
  tenant_id text NOT NULL,
  scope text NOT NULL,
  scope_id text NOT NULL,
  ingredient_id text NOT NULL,
  maximum integer NOT NULL,
  reorder_point integer NOT NULL,
  minimum integer NOT NULL,
  PRIMARY KEY (tenant_id, scope, scope_id, ingredient_id),
  CONSTRAINT stock_levels_scope CHECK (scope IN ('site', 'location')),
  CONSTRAINT stock_levels_order CHECK (
    minimum >= 0
    AND reorder_point >= minimum
    AND maximum >= reorder_point
  )
);

CREATE TABLE dish_levels (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  product_id text NOT NULL,
  minimum integer NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, product_id),
  CONSTRAINT dish_levels_minimum CHECK (minimum >= 0)
);

CREATE TABLE coverage_settings (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  weeks integer,
  margin_hours integer,
  slot_minutes integer,
  service_start_minute integer,
  service_end_minute integer,
  PRIMARY KEY (tenant_id, venue_id)
);

CREATE TABLE notification_rules (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  escalation_minutes integer,
  shortage_alerts_enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, venue_id),
  CONSTRAINT notification_rules_minutes CHECK (
    escalation_minutes IS NULL OR escalation_minutes >= 1
  )
);

CREATE TABLE shortage_alerts (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  opened_at text NOT NULL,
  brand_id text,
  location_id text,
  ingredient_id text,
  product_id text,
  severity text,
  sold_out boolean,
  escalation_clock text,
  seen_by text,
  seen_at text,
  resolved_by text,
  resolved_at text,
  reason text,
  hours_left integer,
  remaining_service_hours integer,
  units integer,
  minimum integer,
  limiter_ingredient_ids text,
  document_id text,
  document_kind text,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT shortage_alerts_kind CHECK (kind IN ('level', 'coverage', 'dish')),
  CONSTRAINT shortage_alerts_status CHECK (
    status IN ('open', 'seen', 'resolved')
  ),
  CONSTRAINT shortage_alerts_level CHECK (
    kind <> 'level'
    OR (
      brand_id IS NOT NULL
      AND location_id IS NOT NULL
      AND ingredient_id IS NOT NULL
      AND severity IN ('yellow', 'red', 'critical')
      AND sold_out IS NOT NULL
    )
  ),
  CONSTRAINT shortage_alerts_coverage CHECK (
    kind <> 'coverage'
    OR (
      brand_id IS NOT NULL
      AND location_id IS NOT NULL
      AND ingredient_id IS NOT NULL
      AND hours_left IS NOT NULL
      AND remaining_service_hours IS NOT NULL
    )
  ),
  CONSTRAINT shortage_alerts_dish CHECK (
    kind <> 'dish'
    OR (
      product_id IS NOT NULL
      AND units IS NOT NULL
      AND minimum IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX shortage_alerts_one_open_level
  ON shortage_alerts (tenant_id, location_id, ingredient_id)
  WHERE kind = 'level' AND status <> 'resolved';

CREATE UNIQUE INDEX shortage_alerts_one_open_coverage
  ON shortage_alerts (tenant_id, location_id, ingredient_id)
  WHERE kind = 'coverage' AND status <> 'resolved';

CREATE UNIQUE INDEX shortage_alerts_one_open_dish
  ON shortage_alerts (tenant_id, venue_id, product_id)
  WHERE kind = 'dish' AND status <> 'resolved';

CREATE TABLE role_notices (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  alert_id text NOT NULL,
  role text NOT NULL,
  kind text NOT NULL,
  severity text,
  notified_at text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT role_notices_alert_role UNIQUE (tenant_id, alert_id, role),
  CONSTRAINT role_notices_kind CHECK (kind IN ('level', 'coverage', 'dish'))
);

CREATE TABLE suggested_stock_levels (
  tenant_id text NOT NULL,
  id text NOT NULL,
  brand_id text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  maximum integer NOT NULL,
  reorder_point integer NOT NULL,
  minimum integer NOT NULL,
  lead_time_days integer NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT suggested_stock_levels_status CHECK (
    status IN ('pending', 'active')
  ),
  CONSTRAINT suggested_stock_levels_order CHECK (
    minimum >= 0
    AND reorder_point >= minimum
    AND maximum >= reorder_point
  ),
  CONSTRAINT suggested_stock_levels_lead CHECK (lead_time_days >= 0)
);

ALTER TABLE stock_level_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_level_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_level_templates
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_levels
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE dish_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dish_levels
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE coverage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON coverage_settings
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_rules
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE shortage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shortage_alerts
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE role_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_notices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_notices
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE suggested_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_stock_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON suggested_stock_levels
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE ON stock_level_templates TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON stock_levels TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON dish_levels TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON coverage_settings TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON notification_rules TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shortage_alerts TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_notices TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON suggested_stock_levels TO inventory_app;
