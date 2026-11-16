-- Low-units threshold on the venue price. Null skips low_units.
-- The stored menu flag is separate from manual availability.
-- orders_app is created in 0001_menu.sql. No backfill.

ALTER TABLE venue_prices
  ADD COLUMN low_units_threshold integer,
  ADD CONSTRAINT venue_prices_low_units_threshold CHECK (
    low_units_threshold IS NULL OR low_units_threshold >= 0
  );

CREATE TABLE menu_inventory_states (
  tenant_id text NOT NULL,
  menu_id text NOT NULL,
  venue_id text NOT NULL,
  product_id text NOT NULL,
  state text NOT NULL,
  PRIMARY KEY (tenant_id, menu_id, venue_id, product_id),
  CONSTRAINT menu_inventory_states_state CHECK (
    state IN ('available', 'low_units', 'sold_out')
  )
);

ALTER TABLE menu_inventory_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_inventory_states FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menu_inventory_states
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON menu_inventory_states TO orders_app;
