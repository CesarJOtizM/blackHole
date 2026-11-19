-- Transfers reuse stock_movements. Run this after 0003_purchasing.sql.
-- transfer_in updates stock_balances.average_cost from the receipt.
-- Sale columns stay null. Nothing is written to stock_movement_outbox.
-- No backfill. SQLite is not a transfer runtime.
-- inventory_app is created in 0001_recipe_catalog.sql.

CREATE TABLE transfers (
  tenant_id text NOT NULL,
  id text NOT NULL,
  origin_location_id text NOT NULL,
  destination_location_id text NOT NULL,
  status text NOT NULL,
  dispatched_at text,
  in_transit_at text,
  dispatched_by text,
  received_at text,
  received_by text,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT transfers_status CHECK (
    status IN (
      'requested',
      'in_transit',
      'received',
      'received_with_differences'
    )
  )
);

CREATE TABLE transfer_lines (
  tenant_id text NOT NULL,
  transfer_id text NOT NULL,
  position integer NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  unit_cost integer,
  received_quantity integer,
  shortfall integer,
  PRIMARY KEY (tenant_id, transfer_id, position),
  UNIQUE (tenant_id, transfer_id, ingredient_id),
  CONSTRAINT transfer_lines_position CHECK (position >= 1),
  CONSTRAINT transfer_lines_quantity CHECK (quantity > 0),
  CONSTRAINT transfer_lines_unit_cost CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT transfer_lines_received CHECK (
    received_quantity IS NULL
    OR (
      received_quantity >= 0
      AND received_quantity <= quantity
    )
  ),
  CONSTRAINT transfer_lines_shortfall CHECK (
    shortfall IS NULL OR shortfall >= 0
  )
);

CREATE TABLE stock_levels (
  tenant_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  minimum integer NOT NULL,
  maximum integer NOT NULL,
  PRIMARY KEY (tenant_id, location_id, ingredient_id),
  CONSTRAINT stock_levels_minimum CHECK (minimum >= 0),
  CONSTRAINT stock_levels_maximum CHECK (maximum >= minimum)
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transfers
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON transfer_lines
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

GRANT SELECT, INSERT, UPDATE ON
  transfers,
  transfer_lines,
  stock_levels
TO inventory_app;
