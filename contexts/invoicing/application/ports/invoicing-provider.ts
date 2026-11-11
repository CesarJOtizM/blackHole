export interface InvoiceValidation {
  referenceCode: string;
}

export interface DocumentIssuance {
  number: string;
  cufe: string;
  qr: string;
}

export const REFERENCE_LOOKUP = {
  EMPTY: "empty",
  VALIDATED: "validated",
  PENDING: "pending",
  MISSING: "missing",
  REJECTED: "rejected",
} as const;

export interface EmptyLookup {
  outcome: typeof REFERENCE_LOOKUP.EMPTY;
}

export interface ValidatedLookup {
  outcome: typeof REFERENCE_LOOKUP.VALIDATED;
  number: string;
  cufe: string;
}

export interface PendingLookup {
  outcome: typeof REFERENCE_LOOKUP.PENDING;
}

export interface MissingLookup {
  outcome: typeof REFERENCE_LOOKUP.MISSING;
}

export interface RejectedLookup {
  outcome: typeof REFERENCE_LOOKUP.REJECTED;
}

export type ReferenceLookup =
  | EmptyLookup
  | ValidatedLookup
  | PendingLookup
  | MissingLookup
  | RejectedLookup;

export class ReferenceQueryFailed extends Error {
  constructor() {
    super("The provider could not query the reference.");
    this.name = "ReferenceQueryFailed";
  }
}

export interface AcquirerQuery {
  documentType: string;
  documentNumber: string;
}

export const ACQUIRER_LOOKUP = {
  FOUND: "found",
  EMPTY: "empty",
} as const;

export interface FoundAcquirerLookup {
  outcome: typeof ACQUIRER_LOOKUP.FOUND;
  name: string;
  email: string;
}

export interface EmptyAcquirerLookup {
  outcome: typeof ACQUIRER_LOOKUP.EMPTY;
}

export type AcquirerLookup = FoundAcquirerLookup | EmptyAcquirerLookup;

export class AcquirerLookupFailed extends Error {
  constructor() {
    super("The provider could not look up the acquirer.");
    this.name = "AcquirerLookupFailed";
  }
}

export class InvoicePdfDownloadFailed extends Error {
  constructor() {
    super("The provider could not download the invoice PDF.");
    this.name = "InvoicePdfDownloadFailed";
  }
}

export interface CreditNoteValidation {
  referenceCode: string;
  originalReferenceCode: string;
}

export class CreditNoteValidationFailed extends Error {
  constructor() {
    super("The provider could not validate the credit note.");
    this.name = "CreditNoteValidationFailed";
  }
}

export abstract class InvoicingProvider<TValidation = void> {
  abstract validate(invoice: InvoiceValidation): Promise<TValidation>;

  findByReference(_referenceCode: string): Promise<ReferenceLookup> {
    return Promise.reject(new ReferenceQueryFailed());
  }

  deleteAttempt(_referenceCode: string): Promise<void> {
    return Promise.reject(new ReferenceQueryFailed());
  }

  lookupAcquirer(_query: AcquirerQuery): Promise<AcquirerLookup> {
    return Promise.reject(new AcquirerLookupFailed());
  }

  downloadPdf(_number: string): Promise<Uint8Array> {
    return Promise.reject(new InvoicePdfDownloadFailed());
  }

  validateCreditNote(_note: CreditNoteValidation): Promise<void> {
    return Promise.reject(new CreditNoteValidationFailed());
  }
}
