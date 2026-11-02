CREATE TABLE sales_documents (
  tenant_id text NOT NULL,
  closure_id text NOT NULL,
  reference_code text NOT NULL,
  status text NOT NULL,
  hold_reason text,
  buyer jsonb NOT NULL,
  content jsonb NOT NULL,
  invoice_number text,
  cufe text,
  qr text,
  PRIMARY KEY (tenant_id, closure_id),
  CONSTRAINT sales_documents_reference UNIQUE (tenant_id, reference_code),
  CONSTRAINT sales_documents_status CHECK (
    status IN (
      'generated',
      'sending',
      'accepted',
      'rejected',
      'pending_issuance',
      'uncertain'
    )
  ),
  CONSTRAINT sales_documents_hold_reason CHECK (
    hold_reason IS NULL OR hold_reason IN ('no_balance')
  ),
  CONSTRAINT sales_documents_issuance CHECK (
    (
      invoice_number IS NULL
      AND cufe IS NULL
      AND qr IS NULL
    )
    OR (
      invoice_number IS NOT NULL
      AND cufe IS NOT NULL
      AND qr IS NOT NULL
    )
  ),
  CONSTRAINT sales_documents_hold_has_no_issuance CHECK (
    hold_reason IS NULL
    OR (
      invoice_number IS NULL
      AND cufe IS NULL
      AND qr IS NULL
    )
  ),
  CONSTRAINT sales_documents_buyer_object CHECK (jsonb_typeof(buyer) = 'object'),
  CONSTRAINT sales_documents_content_object CHECK (
    jsonb_typeof(content) = 'object'
  )
);

ALTER TABLE sales_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_documents
  FOR ALL
  TO invoicing_app
  USING (tenant_id = current_setting('app.tenant_id'))
  WITH CHECK (tenant_id = current_setting('app.tenant_id'));

GRANT SELECT, INSERT ON sales_documents TO invoicing_app;

CREATE TRIGGER sales_documents_reject_update
  BEFORE UPDATE ON sales_documents
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER sales_documents_reject_delete
  BEFORE DELETE ON sales_documents
  FOR EACH ROW
  EXECUTE FUNCTION invoicing_reject_mutation();

CREATE TRIGGER sales_documents_reject_truncate
  BEFORE TRUNCATE ON sales_documents
  FOR EACH STATEMENT
  EXECUTE FUNCTION invoicing_reject_mutation();
