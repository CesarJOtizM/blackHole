-- Production runs share the stock ledger. No movement backfill.
-- output_quantity stays null on recipes already published.
-- A run does not enqueue after_sales. Sale columns stay null.
-- inventory_app is created in 0001_recipe_catalog.sql.

ALTER TABLE recipes
  ADD COLUMN output_quantity integer;

ALTER TABLE recipes
  ADD CONSTRAINT recipes_output_quantity CHECK (
    output_quantity IS NULL OR output_quantity > 0
  );

ALTER TABLE recipe_versions
  ADD COLUMN output_quantity integer;

ALTER TABLE recipe_versions
  ADD CONSTRAINT recipe_versions_output_quantity CHECK (
    output_quantity IS NULL OR output_quantity > 0
  );

CREATE TABLE production_runs (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  recipe_id text NOT NULL,
  recipe_version integer NOT NULL,
  expected_quantity integer NOT NULL,
  actual_quantity integer NOT NULL,
  variance integer NOT NULL,
  output_unit_cost integer,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT production_runs_version CHECK (recipe_version >= 1),
  CONSTRAINT production_runs_expected CHECK (expected_quantity > 0),
  CONSTRAINT production_runs_actual CHECK (actual_quantity >= 0),
  CONSTRAINT production_runs_output_cost CHECK (
    output_unit_cost IS NULL OR output_unit_cost >= 0
  )
);

CREATE TABLE production_cost_policies (
  tenant_id text NOT NULL,
  cost_rule text NOT NULL,
  PRIMARY KEY (tenant_id),
  CONSTRAINT production_cost_policies_rule CHECK (
    cost_rule IN ('consumed_average', 'standard')
  )
);

CREATE TABLE preparation_standard_costs (
  tenant_id text NOT NULL,
  recipe_id text NOT NULL,
  standard_unit_cost integer NOT NULL,
  PRIMARY KEY (tenant_id, recipe_id),
  CONSTRAINT preparation_standard_costs_cost CHECK (standard_unit_cost >= 0)
);

ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON production_runs
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE production_cost_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_cost_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON production_cost_policies
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE preparation_standard_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_standard_costs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON preparation_standard_costs
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON production_runs TO inventory_app;
GRANT SELECT, INSERT, UPDATE ON production_cost_policies TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON preparation_standard_costs TO inventory_app;
