CREATE ROLE printing_app;

CREATE TABLE printers (
  tenant_id text NOT NULL,
  id text NOT NULL,
  paper text NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT printers_paper CHECK (paper IN ('80', '58'))
);

CREATE TABLE print_jobs (
  tenant_id text NOT NULL,
  id text NOT NULL,
  command_id text NOT NULL,
  printer_id text NOT NULL,
  document text NOT NULL,
  paper text NOT NULL,
  status text NOT NULL,
  kick_drawer boolean NOT NULL,
  columns integer NOT NULL,
  body text NOT NULL,
  pulse jsonb,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT print_jobs_command UNIQUE (tenant_id, command_id),
  CONSTRAINT print_jobs_document CHECK (
    document IN (
      'kitchen_ticket',
      'pre_bill',
      'invoice',
      'offline_receipt',
      'cash_close',
      'transfer',
      'tips_settlement'
    )
  ),
  CONSTRAINT print_jobs_paper CHECK (paper IN ('80', '58')),
  CONSTRAINT print_jobs_status CHECK (
    status IN ('waiting', 'printed', 'failed')
  ),
  CONSTRAINT print_jobs_columns CHECK (columns IN (32, 48)),
  CONSTRAINT print_jobs_pulse_array CHECK (
    pulse IS NULL OR jsonb_typeof(pulse) = 'array'
  )
);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON printers
  FOR ALL
  TO printing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON print_jobs
  FOR ALL
  TO printing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON printers, print_jobs TO printing_app;
