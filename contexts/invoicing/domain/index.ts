export const layer = "domain" as const;

export type {
  AssessWithholdingsInput,
  WithholdingAssessment,
  WithholdingCustomer,
  WithholdingInvoiceTax,
} from "#domain/assess-withholdings.js";
export {
  assessWithholdings,
  WithholdingRejected,
} from "#domain/assess-withholdings.js";
export type {
  BagLine,
  CalculateTaxesInput,
  FiscalProfile,
  TaxAmount,
  TaxBreakdown,
  TaxChannel,
  TaxComponent,
  TaxedLine,
  TaxLine,
  TaxRegime,
  TaxRule,
} from "#domain/calculate-taxes.js";
export {
  CashRoundingRejected,
  calculateTaxes,
  InvalidTaxAmount,
  InvalidTaxId,
  NoMatchingTaxRule,
} from "#domain/calculate-taxes.js";
export type { DocumentContent } from "#domain/document-content.js";
export { createDocumentContent } from "#domain/document-content.js";
export type {
  CreateSalesDocument,
  GenericBuyer,
  SalesDocument,
  SalesDocumentStatus,
} from "#domain/sales-document.js";
export {
  assertNitCheckDigit,
  createSalesDocument,
  InvalidNitCheckDigit,
  InvalidReferenceCode,
  SALES_DOCUMENT_STATUS,
} from "#domain/sales-document.js";
