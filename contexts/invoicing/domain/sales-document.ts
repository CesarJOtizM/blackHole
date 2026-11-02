const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const NIT_WITH_CHECK_DIGIT = /^(\d{1,15})-?(\d)$/;

const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

const GENERIC_BUYER_IDENTITY = {
  documentType: "13",
  documentNumber: "222222222222",
  name: "Consumidor final",
  responsibility: "R-99-PN",
} as const;

export const SALES_DOCUMENT_STATUS = {
  GENERATED: "generated",
  SENDING: "sending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PENDING_ISSUANCE: "pending_issuance",
  UNCERTAIN: "uncertain",
} as const;

export type SalesDocumentStatus =
  (typeof SALES_DOCUMENT_STATUS)[keyof typeof SALES_DOCUMENT_STATUS];

export interface GenericBuyer {
  documentType: (typeof GENERIC_BUYER_IDENTITY)["documentType"];
  documentNumber: (typeof GENERIC_BUYER_IDENTITY)["documentNumber"];
  name: (typeof GENERIC_BUYER_IDENTITY)["name"];
  responsibility: (typeof GENERIC_BUYER_IDENTITY)["responsibility"];
  email: string;
}

export interface SalesDocument {
  closureId: string;
  referenceCode: string;
  status: SalesDocumentStatus;
  buyer: GenericBuyer;
  number?: string;
  cufe?: string;
  qr?: string;
}

export interface CreateSalesDocument {
  closureId: string;
  referenceCode: string;
  taxpayerEmail: string;
}

export class InvalidReferenceCode extends Error {
  constructor() {
    super("A sales document reference must be a UUIDv7.");
    this.name = "InvalidReferenceCode";
  }
}

export class InvalidNitCheckDigit extends Error {
  constructor() {
    super("The NIT check digit failed modulus 11.");
    this.name = "InvalidNitCheckDigit";
  }
}

const modulus11CheckDigit = (body: string): number => {
  let sum = 0;

  for (let index = 0; index < body.length; index += 1) {
    const weight = NIT_WEIGHTS[index] ?? 0;
    const digit = body.charCodeAt(body.length - 1 - index) - 48;

    sum += digit * weight;
  }

  const remainder = sum % 11;

  if (remainder < 2) {
    return remainder;
  }

  return 11 - remainder;
};

export const assertNitCheckDigit = (nit: string): void => {
  const match = NIT_WITH_CHECK_DIGIT.exec(nit);

  if (!match) {
    throw new InvalidNitCheckDigit();
  }

  const body = match[1] ?? "";
  const checkDigit = Number(match[2]);

  if (modulus11CheckDigit(body) !== checkDigit) {
    throw new InvalidNitCheckDigit();
  }
};

export const createSalesDocument = (
  input: CreateSalesDocument,
  recorded: readonly SalesDocument[] = [],
): SalesDocument => {
  const existing = recorded.find(
    (document) => document.closureId === input.closureId,
  );

  if (existing) {
    return existing;
  }

  if (!UUID_V7.test(input.referenceCode)) {
    throw new InvalidReferenceCode();
  }

  return {
    closureId: input.closureId,
    referenceCode: input.referenceCode,
    status: SALES_DOCUMENT_STATUS.GENERATED,
    buyer: {
      documentType: GENERIC_BUYER_IDENTITY.documentType,
      documentNumber: GENERIC_BUYER_IDENTITY.documentNumber,
      name: GENERIC_BUYER_IDENTITY.name,
      responsibility: GENERIC_BUYER_IDENTITY.responsibility,
      email: input.taxpayerEmail,
    },
  };
};
