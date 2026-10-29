CREATE TABLE dining_tables (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  zone text NOT NULL,
  state text NOT NULL,
  diners integer NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, id),
  CONSTRAINT dining_tables_state CHECK (
    state IN ('free', 'occupied', 'check_requested', 'to_clean')
  )
);

CREATE TABLE checks (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  table_id text NOT NULL,
  opened_at text NOT NULL,
  first_sent_at text,
  table_state text NOT NULL,
  pre_bill_requested_at text,
  PRIMARY KEY (tenant_id, venue_id, id),
  CONSTRAINT checks_table_state CHECK (
    table_state IN ('occupied', 'check_requested')
  )
);

ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dining_tables
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON checks
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

CREATE TABLE orders (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  check_id text NOT NULL,
  channel text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, id),
  CONSTRAINT orders_channel CHECK (
    channel IN ('waiter', 'fixed_point')
  )
);

CREATE TABLE order_lines (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  check_id text NOT NULL,
  order_id text NOT NULL,
  product_id text NOT NULL,
  name text NOT NULL,
  course integer NOT NULL,
  price integer NOT NULL,
  state text NOT NULL,
  origin_table_id text NOT NULL,
  note text,
  variant_ids jsonb NOT NULL,
  modifier_ids jsonb NOT NULL,
  sent_at text,
  in_preparation_at text,
  ready_at text,
  delivered_at text,
  position integer NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, id),
  CONSTRAINT order_lines_state CHECK (
    state IN ('held', 'sent', 'in_preparation', 'ready', 'delivered')
  )
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_lines
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON
  dining_tables,
  checks,
  orders,
  order_lines
TO orders_app;

-- Rollback drops dining_tables and checks. It does not drop orders_app.
-- DROP TABLE checks;
-- DROP TABLE dining_tables;
-- Unit 16 rollback drops order_lines and orders.
-- It does not drop checks, dining_tables, or orders_app.
-- DROP TABLE order_lines;
-- DROP TABLE orders;

CREATE TABLE station_routes (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  name text NOT NULL,
  output text NOT NULL,
  red_threshold_minutes integer NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, id),
  CONSTRAINT station_routes_output CHECK (
    output IN ('screen', 'printer', 'both')
  )
);

CREATE TABLE station_route_products (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  station_id text NOT NULL,
  product_id text NOT NULL,
  PRIMARY KEY (tenant_id, venue_id, product_id)
);

ALTER TABLE station_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_routes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON station_routes
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE station_route_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_route_products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON station_route_products
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, DELETE ON
  station_routes,
  station_route_products
TO orders_app;

-- Unit 17 rollback drops station_route_products and station_routes.
-- It does not drop orders_app, dining_tables, checks, orders, or order_lines.
-- DROP TABLE station_route_products;
-- DROP TABLE station_routes;
