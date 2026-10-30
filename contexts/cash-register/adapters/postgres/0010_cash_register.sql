CREATE ROLE cash_register_app;

CREATE TABLE cash_shifts (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  register_id text NOT NULL,
  cashier_id text NOT NULL,
  opening_float_cop integer NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT cash_shifts_id_prefix CHECK (
    id LIKE 'shift_%' AND length(id) > length('shift_')
  ),
  CONSTRAINT cash_shifts_opening_float_cop CHECK (opening_float_cop >= 0),
  CONSTRAINT cash_shifts_status CHECK (status IN ('open', 'counting', 'closed'))
);

CREATE UNIQUE INDEX cash_shifts_one_open
  ON cash_shifts (tenant_id, venue_id, register_id)
  WHERE status IN ('open', 'counting');

CREATE TABLE cash_movements (
  tenant_id text NOT NULL,
  id text NOT NULL,
  shift_id text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  amount_cop integer NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT cash_movements_shift_position UNIQUE (tenant_id, shift_id, position),
  CONSTRAINT cash_movements_id_prefix CHECK (
    id LIKE 'movement_%' AND length(id) > length('movement_')
  ),
  CONSTRAINT cash_movements_kind CHECK (
    kind IN ('cash_in', 'cash_out', 'withdrawal')
  ),
  CONSTRAINT cash_movements_amount_cop CHECK (amount_cop >= 0),
  CONSTRAINT cash_movements_reason CHECK (length(btrim(reason)) > 0)
);

CREATE TABLE payments (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  shift_id text NOT NULL,
  sale_cop integer NOT NULL,
  change_cop integer NOT NULL,
  tenders jsonb NOT NULL,
  tip jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT payments_id_prefix CHECK (
    id LIKE 'payment_%' AND length(id) > length('payment_')
  ),
  CONSTRAINT payments_sale_cop CHECK (sale_cop >= 0),
  CONSTRAINT payments_change_cop CHECK (change_cop >= 0),
  CONSTRAINT payments_tenders_array CHECK (jsonb_typeof(tenders) = 'array'),
  CONSTRAINT payments_tip_object CHECK (jsonb_typeof(tip) = 'object')
);

ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_shifts
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_movements
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON cash_movements, payments TO cash_register_app;

GRANT SELECT, INSERT, UPDATE (status) ON cash_shifts TO cash_register_app;

CREATE FUNCTION cash_register_reject_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'cash register rows are append-only';
END;
$$;

CREATE FUNCTION cash_register_reject_shift_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
    AND NEW.id IS NOT DISTINCT FROM OLD.id
    AND NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id
    AND NEW.register_id IS NOT DISTINCT FROM OLD.register_id
    AND NEW.cashier_id IS NOT DISTINCT FROM OLD.cashier_id
    AND NEW.opening_float_cop IS NOT DISTINCT FROM OLD.opening_float_cop
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'cash shifts may update status only';
END;
$$;

CREATE TRIGGER cash_movements_reject_update
  BEFORE UPDATE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_movements_reject_delete
  BEFORE DELETE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_movements_reject_truncate
  BEFORE TRUNCATE ON cash_movements
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER payments_reject_update
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER payments_reject_delete
  BEFORE DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER payments_reject_truncate
  BEFORE TRUNCATE ON payments
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_shifts_reject_update
  BEFORE UPDATE ON cash_shifts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_shift_change();

CREATE TRIGGER cash_shifts_reject_delete
  BEFORE DELETE ON cash_shifts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_shift_change();

CREATE TRIGGER cash_shifts_reject_truncate
  BEFORE TRUNCATE ON cash_shifts
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_shift_change();

CREATE TABLE account_parts (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  check_id text NOT NULL,
  origin_table_id text NOT NULL,
  amount_cop integer NOT NULL,
  paid boolean NOT NULL,
  lines jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT account_parts_id_prefix CHECK (
    id LIKE 'part_%' AND length(id) > length('part_')
  ),
  CONSTRAINT account_parts_amount_cop CHECK (amount_cop >= 0),
  CONSTRAINT account_parts_origin_table CHECK (length(btrim(origin_table_id)) > 0),
  CONSTRAINT account_parts_lines_array CHECK (jsonb_typeof(lines) = 'array')
);

CREATE TABLE cash_counts (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  register_id text NOT NULL,
  counted_by text NOT NULL,
  status text NOT NULL,
  expected_cash_cop integer,
  counted_cash_cop integer,
  denominations jsonb NOT NULL,
  terminals jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT cash_counts_id_prefix CHECK (
    id LIKE 'count_%' AND length(id) > length('count_')
  ),
  CONSTRAINT cash_counts_status CHECK (status IN ('open', 'counting', 'closed')),
  CONSTRAINT cash_counts_expected_cash_cop CHECK (
    expected_cash_cop IS NULL OR expected_cash_cop >= 0
  ),
  CONSTRAINT cash_counts_counted_cash_cop CHECK (
    counted_cash_cop IS NULL OR counted_cash_cop >= 0
  ),
  CONSTRAINT cash_counts_denominations_array CHECK (
    jsonb_typeof(denominations) = 'array'
  ),
  CONSTRAINT cash_counts_terminals_array CHECK (jsonb_typeof(terminals) = 'array')
);

CREATE TABLE sale_closures (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  check_id text NOT NULL,
  table_id text NOT NULL,
  register_id text NOT NULL,
  command_id text NOT NULL,
  payment_id text NOT NULL,
  status text NOT NULL,
  sale_cop integer NOT NULL,
  change_cop integer NOT NULL,
  lines jsonb NOT NULL,
  tenders jsonb NOT NULL,
  tip jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT sale_closures_one_check UNIQUE (tenant_id, venue_id, check_id),
  CONSTRAINT sale_closures_id_prefix CHECK (
    id LIKE 'closure_%' AND length(id) > length('closure_')
  ),
  CONSTRAINT sale_closures_status CHECK (status = 'queued'),
  CONSTRAINT sale_closures_sale_cop CHECK (sale_cop >= 0),
  CONSTRAINT sale_closures_change_cop CHECK (change_cop >= 0),
  CONSTRAINT sale_closures_lines_array CHECK (jsonb_typeof(lines) = 'array'),
  CONSTRAINT sale_closures_tenders_array CHECK (jsonb_typeof(tenders) = 'array'),
  CONSTRAINT sale_closures_tip_object CHECK (jsonb_typeof(tip) = 'object')
);

ALTER TABLE account_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_parts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON account_parts
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cash_counts
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE sale_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_closures FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sale_closures
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON account_parts, cash_counts, sale_closures TO cash_register_app;

CREATE TRIGGER account_parts_reject_update
  BEFORE UPDATE ON account_parts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER account_parts_reject_delete
  BEFORE DELETE ON account_parts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER account_parts_reject_truncate
  BEFORE TRUNCATE ON account_parts
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_counts_reject_update
  BEFORE UPDATE ON cash_counts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_counts_reject_delete
  BEFORE DELETE ON cash_counts
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER cash_counts_reject_truncate
  BEFORE TRUNCATE ON cash_counts
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER sale_closures_reject_update
  BEFORE UPDATE ON sale_closures
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER sale_closures_reject_delete
  BEFORE DELETE ON sale_closures
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER sale_closures_reject_truncate
  BEFORE TRUNCATE ON sale_closures
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();
