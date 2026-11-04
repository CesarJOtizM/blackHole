ALTER TABLE payments DISABLE TRIGGER payments_reject_update;

ALTER TABLE payments
  ADD COLUMN recorded_at text;

UPDATE payments
SET recorded_at = '1970-01-01T00:00:00.000Z'
WHERE recorded_at IS NULL;

ALTER TABLE payments
  ALTER COLUMN recorded_at SET NOT NULL;

ALTER TABLE payments
  ADD CONSTRAINT payments_recorded_at CHECK (length(btrim(recorded_at)) > 0);

ALTER TABLE payments ENABLE TRIGGER payments_reject_update;

CREATE TABLE tip_rules (
  tenant_id text NOT NULL,
  venue_id text NOT NULL,
  period text NOT NULL,
  mode text NOT NULL,
  shares jsonb NOT NULL,
  PRIMARY KEY (tenant_id, venue_id),
  CONSTRAINT tip_rules_period CHECK (period IN ('shift', 'day', 'week')),
  CONSTRAINT tip_rules_mode CHECK (mode IN ('equal', 'percentage', 'hours')),
  CONSTRAINT tip_rules_shares_array CHECK (jsonb_typeof(shares) = 'array')
);

CREATE TABLE tip_settlements (
  tenant_id text NOT NULL,
  id text NOT NULL,
  venue_id text NOT NULL,
  pool_cop integer NOT NULL,
  residue_cop integer NOT NULL,
  methods jsonb NOT NULL,
  participants jsonb NOT NULL,
  shares jsonb NOT NULL,
  rule jsonb NOT NULL,
  edits jsonb NOT NULL,
  adjusts_settlement_id text,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT tip_settlements_id_prefix CHECK (
    id LIKE 'settlement_%' AND length(id) > length('settlement_')
  ),
  CONSTRAINT tip_settlements_pool_cop CHECK (pool_cop >= 0),
  CONSTRAINT tip_settlements_residue_cop CHECK (residue_cop >= 0),
  CONSTRAINT tip_settlements_methods_array CHECK (jsonb_typeof(methods) = 'array'),
  CONSTRAINT tip_settlements_participants_array CHECK (
    jsonb_typeof(participants) = 'array'
  ),
  CONSTRAINT tip_settlements_shares_array CHECK (jsonb_typeof(shares) = 'array'),
  CONSTRAINT tip_settlements_rule_object CHECK (jsonb_typeof(rule) = 'object'),
  CONSTRAINT tip_settlements_edits_array CHECK (jsonb_typeof(edits) = 'array'),
  CONSTRAINT tip_settlements_adjusts_prefix CHECK (
    adjusts_settlement_id IS NULL
    OR (
      adjusts_settlement_id LIKE 'settlement_%'
      AND length(adjusts_settlement_id) > length('settlement_')
    )
  ),
  CONSTRAINT tip_settlements_adjusts_fk
    FOREIGN KEY (tenant_id, adjusts_settlement_id)
    REFERENCES tip_settlements (tenant_id, id)
);

ALTER TABLE tip_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tip_rules
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE tip_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_settlements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tip_settlements
  FOR ALL
  TO cash_register_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT, UPDATE ON tip_rules TO cash_register_app;

GRANT SELECT, INSERT ON tip_settlements TO cash_register_app;

CREATE TRIGGER tip_settlements_reject_update
  BEFORE UPDATE ON tip_settlements
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER tip_settlements_reject_delete
  BEFORE DELETE ON tip_settlements
  FOR EACH ROW
  EXECUTE FUNCTION cash_register_reject_append_only();

CREATE TRIGGER tip_settlements_reject_truncate
  BEFORE TRUNCATE ON tip_settlements
  FOR EACH STATEMENT
  EXECUTE FUNCTION cash_register_reject_append_only();
