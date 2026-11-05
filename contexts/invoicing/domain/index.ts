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
  BillingConsent,
  BillingConsentDraft,
  BillingDataDraft,
  BillingDataRecord,
  InvoiceSnapshot,
} from "#domain/billing-data.js";
export {
  deleteBillingData,
  IncompleteBillingIdentity,
  InvalidBillingInstant,
  MissingBillingEmail,
  MissingMunicipalityCode,
  recordBillingData,
} from "#domain/billing-data.js";
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
export { maskEmail, maskName } from "#domain/masking.js";
export type {
  IssuedOneTimeCode,
  OneTimeCodeDigest,
  OneTimeCodeDigit,
  OneTimeCodeRecord,
  OneTimeCodeResend,
  OneTimeCodeVerification,
} from "#domain/one-time-code.js";
export {
  ClearOneTimeCodeRejected,
  InvalidOneTimeCodeDigit,
  InvalidOneTimeCodeInstant,
  issueOneTimeCode,
  ONE_TIME_CODE_ATTEMPT_LIMIT,
  ONE_TIME_CODE_LENGTH,
  ONE_TIME_CODE_RESEND_MS,
  ONE_TIME_CODE_TTL_MS,
  resendOneTimeCode,
  verifyOneTimeCode,
} from "#domain/one-time-code.js";
export type {
  EvaluatedPortalLink,
  PortalAccount,
  PortalLinkDisclosure,
  PortalLinkPurpose,
} from "#domain/portal-link.js";
export { PORTAL_LINK_PURPOSE, revealPortalLink } from "#domain/portal-link.js";
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
