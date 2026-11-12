CREATE TABLE qr_payments (
  tenant_id text NOT NULL,
  reference text NOT NULL,
  venue_id text NOT NULL,
  check_id text NOT NULL,
  part_id text,
  balance_cop integer NOT NULL,
  tip_cop integer NOT NULL,
  amount_cop integer NOT NULL,
  instrument text,
  status text NOT NULL,
  started_at bigint NOT NULL,
  voided boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, reference),
  CONSTRAINT qr_payments_reference_prefix CHECK (
    reference LIKE 'qrpay_%' AND length(reference) > length('qrpay_')
  ),
  CONSTRAINT qr_payments_balance_cop CHECK (balance_cop >= 0),
  CONSTRAINT qr_payments_tip_cop CHECK (tip_cop >= 0),
  CONSTRAINT qr_payments_amount_cop CHECK (amount_cop = balance_cop + tip_cop),
  CONSTRAINT qr_payments_status CHECK (
    status IN ('started', 'confirmed', 'pending_application', 'applied')
  ),
  CONSTRAINT qr_payments_instrument CHECK (
    instrument IS NULL
    OR instrument IN ('card', 'nequi', 'daviplata', 'bre-b')
  ),
  CONSTRAINT qr_payments_started_instrument CHECK (
    (status = 'started' AND instrument IS NULL)
    OR (status <> 'started' AND instrument IS NOT NULL)
  ),
  CONSTRAINT qr_payments_started_at CHECK (started_at >= 0)
);

CREATE UNIQUE INDEX qr_payments_one_started
  ON qr_payments (tenant_id, venue_id, check_id, COALESCE(part_id, ''))
  WHERE status = 'started' AND voided = false;

ALTER TABLE qr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON qr_payments
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE (status, instrument, voided)
  ON qr_payments TO cash_register_app;

ALTER TABLE sale_closures DROP CONSTRAINT sale_closures_one_check;

ALTER TABLE sale_closures
  ADD CONSTRAINT sale_closures_one_payment UNIQUE (tenant_id, payment_id);
