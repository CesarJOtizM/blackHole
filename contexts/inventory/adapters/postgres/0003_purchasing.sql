-- Purchasing receipts share the stock ledger. No backfill.
-- Sale columns stay null on a purchase. The line key applies only to sales.

ALTER TABLE stock_balances
  ADD COLUMN average_cost integer NOT NULL DEFAULT 0;

ALTER TABLE stock_movements
  ALTER COLUMN order_line_id DROP NOT NULL,
  ALTER COLUMN role DROP NOT NULL,
  ALTER COLUMN recipe_version DROP NOT NULL;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_line;

CREATE UNIQUE INDEX stock_movements_line
  ON stock_movements (tenant_id, order_line_id, role, ingredient_id)
  WHERE order_line_id IS NOT NULL;

CREATE TABLE suppliers (
  tenant_id text NOT NULL,
  id text NOT NULL,
  identification text NOT NULL,
  name text NOT NULL,
  issues_e_invoices boolean NOT NULL,
  lead_time_days integer NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, identification),
  CONSTRAINT suppliers_lead_time CHECK (lead_time_days >= 0)
);

CREATE TABLE purchase_orders (
  tenant_id text NOT NULL,
  id text NOT NULL,
  supplier_id text NOT NULL,
  location_id text NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT purchase_orders_status CHECK (
    status IN ('open', 'partially_received', 'received', 'cancelled')
  )
);

CREATE TABLE purchase_order_lines (
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  id text NOT NULL,
  ingredient_id text NOT NULL,
  purchase_quantity integer NOT NULL,
  received_quantity integer NOT NULL DEFAULT 0,
  factor integer NOT NULL,
  PRIMARY KEY (tenant_id, order_id, id),
  CONSTRAINT purchase_order_lines_quantity CHECK (purchase_quantity > 0),
  CONSTRAINT purchase_order_lines_received CHECK (
    received_quantity >= 0 AND received_quantity <= purchase_quantity
  ),
  CONSTRAINT purchase_order_lines_factor CHECK (factor > 0)
);

CREATE TABLE purchase_receipts (
  tenant_id text NOT NULL,
  id text NOT NULL,
  location_id text NOT NULL,
  actor_id text NOT NULL,
  occurred_at text NOT NULL,
  purchase_order_id text,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE purchase_receipt_lines (
  tenant_id text NOT NULL,
  receipt_id text NOT NULL,
  position integer NOT NULL,
  ingredient_id text NOT NULL,
  purchase_quantity integer NOT NULL,
  purchase_unit_cost integer NOT NULL,
  factor integer NOT NULL,
  quantity integer NOT NULL,
  unit_cost integer NOT NULL,
  PRIMARY KEY (tenant_id, receipt_id, position),
  CONSTRAINT purchase_receipt_lines_position CHECK (position >= 1),
  CONSTRAINT purchase_receipt_lines_quantity CHECK (purchase_quantity > 0),
  CONSTRAINT purchase_receipt_lines_cost CHECK (purchase_unit_cost >= 0),
  CONSTRAINT purchase_receipt_lines_factor CHECK (factor > 0),
  CONSTRAINT purchase_receipt_lines_base_quantity CHECK (quantity > 0),
  CONSTRAINT purchase_receipt_lines_unit_cost CHECK (unit_cost >= 0)
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON suppliers
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_orders
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_order_lines
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_receipts
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipt_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_receipt_lines
  FOR ALL
  TO inventory_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE ON
  suppliers,
  purchase_orders,
  purchase_order_lines,
  purchase_receipts,
  purchase_receipt_lines
TO inventory_app;
