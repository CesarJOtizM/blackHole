-- Single-tenant node copy of the stock ledger. Quantities stay the signed
-- scaled integers the use cases append. No backfill. Movements are insert-only.

CREATE TABLE stock_movements (
  tenant_id text NOT NULL,
  id text NOT NULL,
  position integer NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  unit_cost integer NOT NULL,
  movement_type text NOT NULL,
  reference text NOT NULL,
  occurred_at text NOT NULL,
  order_line_id text NOT NULL,
  role text NOT NULL,
  recipe_version integer NOT NULL,
  reason text,
  actor_id text,
  reverses_movement_id text,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT stock_movements_line UNIQUE (
    tenant_id,
    order_line_id,
    role,
    ingredient_id
  ),
  CONSTRAINT stock_movements_position CHECK (position >= 1),
  CONSTRAINT stock_movements_quantity CHECK (quantity <> 0),
  CONSTRAINT stock_movements_unit_cost CHECK (unit_cost >= 0),
  CONSTRAINT stock_movements_recipe_version CHECK (recipe_version >= 1),
  CONSTRAINT stock_movements_role CHECK (role IN ('consumption', 'reversal')),
  CONSTRAINT stock_movements_type CHECK (
    movement_type IN (
      'purchase',
      'sale_consumption',
      'sale_return',
      'waste',
      'production_consumption',
      'production_output',
      'transfer_out',
      'transfer_in',
      'count_adjustment'
    )
  )
);

CREATE TRIGGER stock_movements_no_update
BEFORE UPDATE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'A stock movement cannot be changed or deleted.');
END;

CREATE TRIGGER stock_movements_no_delete
BEFORE DELETE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'A stock movement cannot be changed or deleted.');
END;

CREATE TABLE stock_balances (
  tenant_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  PRIMARY KEY (tenant_id, location_id, ingredient_id)
);

CREATE TABLE negative_stock_alerts (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  balance integer NOT NULL,
  occurred_at text NOT NULL,
  PRIMARY KEY (tenant_id, location_id, ingredient_id)
);

CREATE TABLE stock_movement_outbox (
  tenant_id text NOT NULL,
  movement_id text NOT NULL,
  position integer NOT NULL,
  lane text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  unit_cost integer NOT NULL,
  movement_type text NOT NULL,
  order_line_id text NOT NULL,
  recipe_version integer NOT NULL,
  occurred_at text NOT NULL,
  role text NOT NULL,
  PRIMARY KEY (tenant_id, movement_id),
  CONSTRAINT stock_movement_outbox_position CHECK (position >= 1),
  CONSTRAINT stock_movement_outbox_lane CHECK (lane = 'after_sales'),
  CONSTRAINT stock_movement_outbox_role CHECK (role IN ('consumption', 'reversal')),
  CONSTRAINT stock_movement_outbox_type CHECK (
    movement_type IN (
      'purchase',
      'sale_consumption',
      'sale_return',
      'waste',
      'production_consumption',
      'production_output',
      'transfer_out',
      'transfer_in',
      'count_adjustment'
    )
  )
);

CREATE TABLE point_of_sale_locations (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  location_id text NOT NULL,
  PRIMARY KEY (tenant_id, venue_id)
);
