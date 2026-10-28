CREATE ROLE invoicing_app;

CREATE TABLE tax_rules (
  tenant_id text NOT NULL,
  id text NOT NULL,
  version integer NOT NULL,
  position integer NOT NULL,
  name text NOT NULL,
  tax_classification text NOT NULL,
  regime text,
  vat_responsible boolean,
  inc_responsible boolean,
  franchise boolean,
  channel text,
  valid_from text NOT NULL,
  valid_to text,
  fixed_cop integer,
  marker text,
  taxes jsonb NOT NULL,
  rut_responsibilities jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id, version),
  CONSTRAINT tax_rules_position UNIQUE (tenant_id, position),
  CONSTRAINT tax_rules_regime CHECK (
    regime IS NULL OR regime IN ('ordinary', 'simple')
  ),
  CONSTRAINT tax_rules_channel CHECK (
    channel IS NULL OR channel IN ('dine-in', 'take-out', 'delivery')
  ),
  CONSTRAINT tax_rules_marker CHECK (
    marker IS NULL OR marker IN ('is_excluded', 'not_taxed')
  ),
  CONSTRAINT tax_rules_taxes_array CHECK (jsonb_typeof(taxes) = 'array'),
  CONSTRAINT tax_rules_rut_array CHECK (
    jsonb_typeof(rut_responsibilities) = 'array'
  )
);

CREATE TABLE fiscal_templates (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  profile jsonb NOT NULL,
  rules jsonb NOT NULL,
  CONSTRAINT fiscal_templates_profile_object CHECK (
    jsonb_typeof(profile) = 'object'
  ),
  CONSTRAINT fiscal_templates_rules_array CHECK (jsonb_typeof(rules) = 'array')
);

CREATE TABLE adopted_fiscal_profiles (
  tenant_id text NOT NULL,
  id text NOT NULL,
  taxpayer_id text NOT NULL,
  template_id text NOT NULL,
  profile jsonb NOT NULL,
  rules jsonb NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT adopted_fiscal_profiles_profile_object CHECK (
    jsonb_typeof(profile) = 'object'
  ),
  CONSTRAINT adopted_fiscal_profiles_rules_array CHECK (
    jsonb_typeof(rules) = 'array'
  )
);

ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tax_rules
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

ALTER TABLE fiscal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY template_catalog ON fiscal_templates
  FOR ALL
  TO invoicing_app
  USING (true)
  WITH CHECK (true);

ALTER TABLE adopted_fiscal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE adopted_fiscal_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON adopted_fiscal_profiles
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON tax_rules, fiscal_templates TO invoicing_app;

GRANT SELECT, INSERT, UPDATE ON adopted_fiscal_profiles TO invoicing_app;

CREATE FUNCTION invoicing_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'invoicing rows are append-only';
END;
$$;

CREATE TRIGGER tax_rules_reject_update
  BEFORE UPDATE ON tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER tax_rules_reject_delete
  BEFORE DELETE ON tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER tax_rules_reject_truncate
  BEFORE TRUNCATE ON tax_rules
  FOR EACH STATEMENT
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER fiscal_templates_reject_update
  BEFORE UPDATE ON fiscal_templates
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER fiscal_templates_reject_delete
  BEFORE DELETE ON fiscal_templates
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER fiscal_templates_reject_truncate
  BEFORE TRUNCATE ON fiscal_templates
  FOR EACH STATEMENT
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER adopted_fiscal_profiles_reject_delete
  BEFORE DELETE ON adopted_fiscal_profiles
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER adopted_fiscal_profiles_reject_truncate
  BEFORE TRUNCATE ON adopted_fiscal_profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION invoicing_reject_mutation();
