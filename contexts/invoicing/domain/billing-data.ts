import { assertNitCheckDigit } from "#domain/sales-document.js";

const NIT_DOCUMENT_TYPE = "31";

export class IncompleteBillingIdentity extends Error {
  constructor() {
    super("Billing data requires an id type, number, person type, and name.");
    this.name = "IncompleteBillingIdentity";
  }
}

export class MissingBillingEmail extends Error {
  constructor() {
    super("Billing data requires an email.");
    this.name = "MissingBillingEmail";
  }
}

export class MissingMunicipalityCode extends Error {
  constructor() {
    super("Billing data requires a DANE municipality code.");
    this.name = "MissingMunicipalityCode";
  }
}

export class InvalidBillingInstant extends Error {
  constructor() {
    super("The billing data instant is unreadable.");
    this.name = "InvalidBillingInstant";
  }
}

export interface BillingConsentDraft {
  accepted?: boolean;
  policyVersion?: string;
  policyLink?: string;
}

export interface BillingDataDraft {
  documentType?: string;
  documentNumber?: string;
  personType?: string;
  name?: string;
  email?: string;
  municipalityCode?: string;
  consent?: BillingConsentDraft;
  at: string;
}

export interface BillingConsent {
  acceptedAt: string;
  policyVersion: string;
  policyLink: string;
}

export interface InvoiceSnapshot {
  number: string;
}

export interface BillingDataRecord {
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
  consent: BillingConsent;
  deletedAt: string | null;
  invoiceSnapshots: readonly InvoiceSnapshot[];
}

const text = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? undefined : trimmed;
};

const readInstant = (value: string): string => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new InvalidBillingInstant();
  }

  return new Date(parsed).toISOString();
};

const identity = (
  draft: BillingDataDraft,
): Pick<
  BillingDataRecord,
  "documentType" | "documentNumber" | "personType" | "name"
> => {
  const documentType = text(draft.documentType);
  const documentNumber = text(draft.documentNumber);
  const personType = text(draft.personType);
  const name = text(draft.name);

  if (
    documentType === undefined ||
    documentNumber === undefined ||
    personType === undefined ||
    name === undefined
  ) {
    throw new IncompleteBillingIdentity();
  }

  if (documentType === NIT_DOCUMENT_TYPE) {
    assertNitCheckDigit(documentNumber);
  }

  return { documentType, documentNumber, personType, name };
};

const consentOf = (draft: BillingDataDraft): BillingConsent | undefined => {
  const policyVersion = text(draft.consent?.policyVersion);
  const policyLink = text(draft.consent?.policyLink);

  if (
    draft.consent?.accepted !== true ||
    policyVersion === undefined ||
    policyLink === undefined
  ) {
    return undefined;
  }

  return {
    acceptedAt: readInstant(draft.at),
    policyVersion,
    policyLink,
  };
};

export const recordBillingData = (
  draft: BillingDataDraft,
): BillingDataRecord | undefined => {
  const identified = identity(draft);
  const email = text(draft.email);

  if (email === undefined) {
    throw new MissingBillingEmail();
  }

  const municipalityCode = text(draft.municipalityCode);

  if (municipalityCode === undefined) {
    throw new MissingMunicipalityCode();
  }

  const consent = consentOf(draft);

  if (consent === undefined) {
    return undefined;
  }

  return {
    ...identified,
    email,
    municipalityCode,
    consent,
    deletedAt: null,
    invoiceSnapshots: [],
  };
};

export const deleteBillingData = (input: {
  record: BillingDataRecord;
  at: string;
}): BillingDataRecord => ({
  ...input.record,
  consent: { ...input.record.consent },
  deletedAt: readInstant(input.at),
  invoiceSnapshots: input.record.invoiceSnapshots.map((snapshot) => ({
    number: snapshot.number,
  })),
});
