CREATE ROLE inventory_app;

-- Quantities are milli-units. ingredients, unit_conversions, and
-- modifier_deltas keep every published version. recipes and recipe_lines are
-- the latest version. No stock tables.
-- Rollback removes these tables only when no version was published.

CREATE TABLE ingredients (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  base_unit text NOT NULL,
  reference_cost_cop integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, version, id),
  CONSTRAINT ingredients_version CHECK (version >= 1),
  CONSTRAINT ingredients_base_unit CHECK (base_unit IN ('g', 'ml', 'unit')),
  CONSTRAINT ingredients_reference_cost CHECK (reference_cost_cop >= 0)
);

CREATE TABLE unit_conversions (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  ingredient_id text NOT NULL,
  purpose text NOT NULL,
  name text NOT NULL,
  factor integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, version, ingredient_id, purpose),
  CONSTRAINT unit_conversions_version CHECK (version >= 1),
  CONSTRAINT unit_conversions_purpose CHECK (purpose IN ('purchase', 'recipe')),
  CONSTRAINT unit_conversions_factor CHECK (factor > 0)
);

CREATE TABLE recipes (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  product_id text NOT NULL,
  variant_id text,
  PRIMARY KEY (tenant_id, brand_id, id)
);

CREATE TABLE recipe_lines (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  recipe_id text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  ingredient_id text,
  sub_recipe_id text,
  net_quantity integer NOT NULL,
  yield_percent integer NOT NULL,
  stocked boolean,
  PRIMARY KEY (tenant_id, brand_id, recipe_id, position),
  CONSTRAINT recipe_lines_position CHECK (position >= 0),
  CONSTRAINT recipe_lines_quantity CHECK (net_quantity >= 0),
  CONSTRAINT recipe_lines_yield CHECK (yield_percent > 0),
  CONSTRAINT recipe_lines_kind CHECK (
    (
      kind = 'ingredient'
      AND ingredient_id IS NOT NULL
      AND sub_recipe_id IS NULL
      AND stocked IS NULL
    )
    OR (
      kind = 'recipe'
      AND ingredient_id IS NULL
      AND sub_recipe_id IS NOT NULL
      AND stocked IS NOT NULL
    )
  )
);

CREATE TABLE recipe_versions (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  recipe_id text NOT NULL,
  author_id text NOT NULL,
  name text NOT NULL,
  product_id text NOT NULL,
  variant_id text,
  PRIMARY KEY (tenant_id, brand_id, version, recipe_id),
  CONSTRAINT recipe_versions_version CHECK (version >= 1)
);

CREATE TABLE recipe_version_lines (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  recipe_id text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  ingredient_id text,
  sub_recipe_id text,
  net_quantity integer NOT NULL,
  yield_percent integer NOT NULL,
  stocked boolean,
  PRIMARY KEY (tenant_id, brand_id, version, recipe_id, position),
  CONSTRAINT recipe_version_lines_position CHECK (position >= 0),
  CONSTRAINT recipe_version_lines_quantity CHECK (net_quantity >= 0),
  CONSTRAINT recipe_version_lines_yield CHECK (yield_percent > 0),
  CONSTRAINT recipe_version_lines_kind CHECK (
    (
      kind = 'ingredient'
      AND ingredient_id IS NOT NULL
      AND sub_recipe_id IS NULL
      AND stocked IS NULL
    )
    OR (
      kind = 'recipe'
      AND ingredient_id IS NULL
      AND sub_recipe_id IS NOT NULL
      AND stocked IS NOT NULL
    )
  )
);

CREATE TABLE modifier_deltas (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  modifier_id text NOT NULL,
  modifier_name text NOT NULL,
  position integer NOT NULL,
  ingredient_id text,
  quantity integer,
  PRIMARY KEY (tenant_id, brand_id, version, modifier_id, position),
  CONSTRAINT modifier_deltas_version CHECK (version >= 1),
  CONSTRAINT modifier_deltas_position CHECK (position >= 0),
  CONSTRAINT modifier_deltas_pair CHECK (
    (ingredient_id IS NULL AND quantity IS NULL)
    OR (ingredient_id IS NOT NULL AND quantity IS NOT NULL)
  )
);

CREATE TABLE recipe_publications (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  author_id text NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, version),
  CONSTRAINT recipe_publications_version CHECK (version >= 1)
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ingredients
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON unit_conversions
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipes
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE recipe_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipe_lines
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipe_versions
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE recipe_version_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_version_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipe_version_lines
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE modifier_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_deltas FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modifier_deltas
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE recipe_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_publications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipe_publications
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON
  ingredients,
  unit_conversions,
  recipes,
  recipe_lines,
  recipe_versions,
  recipe_version_lines,
  modifier_deltas,
  recipe_publications
TO inventory_app;
