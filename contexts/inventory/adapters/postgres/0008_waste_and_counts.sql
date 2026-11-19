-- Waste and counts. Sessions, lines, and classifications are new.
-- Adjustments reuse stock_movements. recipe_version 0 is a document
-- that is not a published recipe. Sale roles stay valid. No backfill.
-- inventory_app is created in 0001_recipe_catalog.sql.

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_role;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_role CHECK (
    role IN (
      'consumption',
      'reversal',
      'operational_waste',
      'count_adjustment'
    )
  );

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_recipe_version;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_recipe_version CHECK (recipe_version >= 0);

CREATE TABLE count_sessions (
  tenant_id text NOT NULL,
  document_id text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  cut_off text NOT NULL,
  status text NOT NULL,
  value_cop integer NOT NULL,
  PRIMARY KEY (tenant_id, document_id),
  CONSTRAINT count_sessions_status CHECK (status IN ('posted', 'pending')),
  CONSTRAINT count_sessions_value CHECK (value_cop >= 0)
);

CREATE TABLE count_session_lines (
  tenant_id text NOT NULL,
  document_id text NOT NULL,
  position integer NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  average_cost integer NOT NULL,
  value_cop integer NOT NULL,
  PRIMARY KEY (tenant_id, document_id, ingredient_id),
  CONSTRAINT count_session_lines_position CHECK (position >= 1),
  CONSTRAINT count_session_lines_average_cost CHECK (average_cost >= 0),
  CONSTRAINT count_session_lines_value CHECK (value_cop >= 0)
);

CREATE TABLE ingredient_classifications (
  tenant_id text NOT NULL,
  ingredient_id text NOT NULL,
  category text NOT NULL,
  PRIMARY KEY (tenant_id, ingredient_id),
  CONSTRAINT ingredient_classifications_category CHECK (
    length(btrim(category)) > 0
  )
);

ALTER TABLE count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON count_sessions
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE count_session_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_session_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON count_session_lines
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE ingredient_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_classifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ingredient_classifications
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE ON count_sessions TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON count_session_lines TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON ingredient_classifications TO inventory_app;
