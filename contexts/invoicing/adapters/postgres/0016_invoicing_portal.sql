DO $$
BEGIN
  CREATE ROLE invoicing_app;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE remembered_buyers (
  tenant_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  channel text NOT NULL,
  destination text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, document_type, document_number),
  CONSTRAINT remembered_buyers_channel CHECK (channel IN ('email', 'sms'))
);

CREATE TABLE consents (
  tenant_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  person_type text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  municipality_code text NOT NULL,
  accepted_at text,
  policy_version text,
  policy_link text,
  deleted_at text,
  invoice_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (tenant_id, document_type, document_number),
  CONSTRAINT consents_snapshots_array CHECK (
    jsonb_typeof(invoice_snapshots) = 'array'
  )
);

CREATE TABLE one_time_codes (
  tenant_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  digest text NOT NULL,
  sent_at text NOT NULL,
  expires_at text NOT NULL,
  attempts_remaining integer NOT NULL,
  spent boolean NOT NULL,
  PRIMARY KEY (tenant_id, document_type, document_number),
  CONSTRAINT one_time_codes_attempts CHECK (attempts_remaining >= 0)
);

CREATE TABLE portal_lookups (
  lookup_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  name text NOT NULL,
  email text NOT NULL
);

CREATE TABLE acquirer_cache (
  tenant_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  cached_at text NOT NULL,
  PRIMARY KEY (tenant_id, document_type, document_number)
);

CREATE TABLE portal_submissions (
  tenant_id text NOT NULL,
  check_id text NOT NULL,
  document_type text NOT NULL,
  document_number text NOT NULL,
  person_type text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  municipality_code text NOT NULL,
  accepted_at text NOT NULL,
  policy_version text NOT NULL,
  policy_link text NOT NULL,
  deleted_at text,
  invoice_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (tenant_id, check_id),
  CONSTRAINT portal_submissions_snapshots_array CHECK (
    jsonb_typeof(invoice_snapshots) = 'array'
  )
);

CREATE TABLE reinvoice_requests (
  tenant_id text NOT NULL,
  invoice_number text NOT NULL,
  issued_at text NOT NULL,
  requested_at text NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (tenant_id, invoice_number),
  CONSTRAINT reinvoice_requests_status CHECK (
    status IN ('pending', 'approved')
  )
);

CREATE TABLE portal_settings (
  tenant_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  window_mode text NOT NULL DEFAULT 'same_day',
  CONSTRAINT portal_settings_window CHECK (
    window_mode IN ('same_day', 'same_month', 'off')
  )
);

CREATE TABLE portal_rate_windows (
  token text NOT NULL,
  ip text NOT NULL,
  PRIMARY KEY (token, ip)
);

CREATE TABLE dane_municipalities (
  code text PRIMARY KEY,
  name text NOT NULL,
  department_code text NOT NULL,
  department_name text NOT NULL
);

ALTER TABLE remembered_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE remembered_buyers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON remembered_buyers
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON consents
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE one_time_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_time_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON one_time_codes
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE portal_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_lookups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON portal_lookups
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE acquirer_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquirer_cache FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON acquirer_cache
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE portal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON portal_submissions
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE reinvoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reinvoice_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reinvoice_requests
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON portal_settings
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE portal_rate_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_rate_windows FORCE ROW LEVEL SECURITY;
CREATE POLICY portal_rate_window ON portal_rate_windows
  FOR ALL
  TO invoicing_app
  USING (true)
  WITH CHECK (true);

ALTER TABLE dane_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dane_municipalities FORCE ROW LEVEL SECURITY;
CREATE POLICY municipality_catalog ON dane_municipalities
  FOR SELECT
  TO invoicing_app
  USING (true);

GRANT SELECT, INSERT, UPDATE ON remembered_buyers TO invoicing_app;
GRANT SELECT, INSERT, UPDATE ON consents TO invoicing_app;
GRANT SELECT, INSERT, UPDATE ON one_time_codes TO invoicing_app;
GRANT SELECT, INSERT ON portal_lookups TO invoicing_app;
GRANT SELECT, INSERT, UPDATE ON acquirer_cache TO invoicing_app;
GRANT SELECT, INSERT, UPDATE ON portal_submissions TO invoicing_app;
GRANT SELECT, INSERT, UPDATE ON reinvoice_requests TO invoicing_app;
GRANT SELECT, INSERT ON portal_settings TO invoicing_app;
GRANT SELECT, INSERT ON portal_rate_windows TO invoicing_app;
GRANT SELECT ON dane_municipalities TO invoicing_app;
