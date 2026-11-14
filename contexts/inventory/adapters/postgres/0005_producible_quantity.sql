-- Producible quantity is a read model. On-hand stays in stock_balances.
-- Nothing here inserts into stock_movements. No backfill.
-- variant_id is empty when the product has no variant.
-- inventory_app is created in 0001_recipe_catalog.sql.

CREATE TABLE producible_ingredient_index (
  tenant_id text NOT NULL,
  site_id text NOT NULL,
  ingredient_id text NOT NULL,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, site_id, ingredient_id, product_id, variant_id),
  CONSTRAINT producible_ingredient_index_position CHECK (position >= 0)
);

CREATE TABLE producible_quantities (
  tenant_id text NOT NULL,
  site_id text NOT NULL,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  point_units integer NOT NULL,
  replenishment_units integer NOT NULL,
  state text NOT NULL,
  PRIMARY KEY (tenant_id, site_id, product_id, variant_id),
  CONSTRAINT producible_quantities_point_units CHECK (point_units >= 0),
  CONSTRAINT producible_quantities_replenishment_units CHECK (
    replenishment_units >= 0
  ),
  CONSTRAINT producible_quantities_state CHECK (
    state IN ('available', 'low_units', 'sold_out')
  )
);

CREATE TABLE producible_limiting_ingredients (
  tenant_id text NOT NULL,
  site_id text NOT NULL,
  product_id text NOT NULL,
  variant_id text NOT NULL,
  position integer NOT NULL,
  ingredient_id text NOT NULL,
  PRIMARY KEY (tenant_id, site_id, product_id, variant_id, position),
  CONSTRAINT producible_limiting_ingredients_position CHECK (position >= 0)
);

ALTER TABLE producible_ingredient_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE producible_ingredient_index FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON producible_ingredient_index
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE producible_quantities ENABLE ROW LEVEL SECURITY;
ALTER TABLE producible_quantities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON producible_quantities
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE producible_limiting_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE producible_limiting_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON producible_limiting_ingredients
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  producible_ingredient_index,
  producible_quantities,
  producible_limiting_ingredients
TO inventory_app;
