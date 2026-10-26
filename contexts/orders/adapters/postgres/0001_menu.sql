CREATE ROLE orders_app;

CREATE TABLE menus (
  id text NOT NULL,
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT menus_tenant_brand UNIQUE (tenant_id, brand_id)
);

CREATE TABLE products (
  id text NOT NULL,
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  name text NOT NULL,
  price integer NOT NULL,
  tax_classification text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, id)
);

CREATE TABLE variants (
  id text NOT NULL,
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  product_id text NOT NULL,
  name text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, id)
);

CREATE TABLE modifiers (
  id text NOT NULL,
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  product_id text NOT NULL,
  name text NOT NULL,
  price integer NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, id)
);

CREATE TABLE combos (
  id text NOT NULL,
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  name text NOT NULL,
  price integer NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, id)
);

CREATE TABLE combo_components (
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  combo_id text NOT NULL,
  product_id text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, combo_id, position)
);

CREATE TABLE venue_prices (
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  venue_id text NOT NULL,
  item_id text NOT NULL,
  price integer NOT NULL,
  available boolean NOT NULL,
  window_start text,
  window_end text,
  PRIMARY KEY (tenant_id, menu_id, venue_id, item_id),
  CONSTRAINT venue_prices_window CHECK (
    (window_start IS NULL AND window_end IS NULL)
    OR (window_start IS NOT NULL AND window_end IS NOT NULL)
  )
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menus
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON variants
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modifiers
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON combos
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE combo_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_components FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON combo_components
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE venue_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_prices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON venue_prices
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON
  menus,
  products,
  variants,
  modifiers,
  combos,
  combo_components,
  venue_prices
TO orders_app;
