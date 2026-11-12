CREATE TABLE table_qr_tokens (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  table_id text NOT NULL,
  digest text NOT NULL,
  retired boolean NOT NULL,
  PRIMARY KEY (tenant_id, digest),
  CONSTRAINT table_qr_tokens_digest UNIQUE (digest)
);

CREATE TABLE qr_table_settings (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  acceptance text NOT NULL DEFAULT 'direct',
  stale_after_seconds integer NOT NULL DEFAULT 900,
  PRIMARY KEY (tenant_id, venue_id),
  CONSTRAINT qr_table_settings_acceptance CHECK (
    acceptance IN ('direct', 'cash_register')
  )
);

ALTER TABLE table_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_qr_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON table_qr_tokens
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE qr_table_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_table_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON qr_table_settings
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  table_qr_tokens,
  qr_table_settings
TO orders_app;

CREATE FUNCTION table_qr_find_digest(sought text)
RETURNS TABLE (
  tenant_id text,
  venue_id text,
  table_id text,
  digest text,
  retired boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    table_qr_tokens.tenant_id,
    table_qr_tokens.venue_id,
    table_qr_tokens.table_id,
    table_qr_tokens.digest,
    table_qr_tokens.retired
  FROM public.table_qr_tokens
  WHERE table_qr_tokens.digest = sought
$$;

REVOKE ALL ON FUNCTION table_qr_find_digest(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION table_qr_find_digest(text) TO orders_app;

ALTER TABLE orders DROP CONSTRAINT orders_channel;
ALTER TABLE orders ADD CONSTRAINT orders_channel CHECK (
  channel IN ('waiter', 'fixed_point', 'qr_table')
);

CREATE TABLE qr_order_intents (
  id text NOT NULL,
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  table_id text NOT NULL,
  status text NOT NULL,
  lines jsonb NOT NULL,
  unavailable_product_ids jsonb NOT NULL,
  sent_line_ids jsonb NOT NULL,
  check_id text,
  created_at text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT qr_order_intents_id UNIQUE (id),
  CONSTRAINT qr_order_intents_status CHECK (
    status IN ('pending_acceptance', 'applied', 'rejected')
  )
);

ALTER TABLE qr_order_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_order_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON qr_order_intents
  FOR ALL
  TO orders_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE, DELETE ON qr_order_intents TO orders_app;

