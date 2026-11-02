import {
  ACQUIRER_LOOKUP,
  type InvoicingProvider,
} from "#application/ports/invoicing-provider.js";
import {
  assertNitCheckDigit,
  type GenericBuyer,
} from "#domain/sales-document.js";

export const BUYER_DOCUMENT_TYPE = {
  ID_CARD: "13",
  NIT: "31",
} as const;

export type BuyerDocumentType =
  (typeof BUYER_DOCUMENT_TYPE)[keyof typeof BUYER_DOCUMENT_TYPE];

export const ATTACH_BUYER_RESULT = {
  GENERIC: "generic",
  IDENTIFIED: "identified",
} as const;

export type AttachBuyerResultKind =
  (typeof ATTACH_BUYER_RESULT)[keyof typeof ATTACH_BUYER_RESULT];

const GENERIC_BUYER_IDENTITY = {
  documentType: BUYER_DOCUMENT_TYPE.ID_CARD,
  documentNumber: "222222222222",
  name: "Consumidor final",
  responsibility: "R-99-PN",
} as const;

export interface AttachBuyerCommand {
  taxpayerEmail: string;
  documentType?: string;
  documentNumber?: string;
}

export interface IdentifiedBuyer {
  documentType: string;
  documentNumber: string;
  name: string;
}

export interface BuyerLookup {
  name: string;
  email: string;
}

export interface GenericAttachment {
  kind: typeof ATTACH_BUYER_RESULT.GENERIC;
  buyer: GenericBuyer;
}

export interface IdentifiedAttachment {
  kind: typeof ATTACH_BUYER_RESULT.IDENTIFIED;
  buyer: IdentifiedBuyer;
  lookup: BuyerLookup;
}

export type AttachedBuyer = GenericAttachment | IdentifiedAttachment;

export class AttachBuyer {
  constructor(private readonly provider: InvoicingProvider) {}

  async execute(command: AttachBuyerCommand): Promise<AttachedBuyer> {
    if (!command.documentType || !command.documentNumber) {
      return genericAttachment(command.taxpayerEmail);
    }

    if (command.documentType === BUYER_DOCUMENT_TYPE.NIT) {
      assertNitCheckDigit(command.documentNumber);
    }

    const lookup = await this.provider.lookupAcquirer({
      documentType: command.documentType,
      documentNumber: command.documentNumber,
    });

    switch (lookup.outcome) {
      case ACQUIRER_LOOKUP.EMPTY:
        return genericAttachment(command.taxpayerEmail);
      case ACQUIRER_LOOKUP.FOUND:
        return {
          kind: ATTACH_BUYER_RESULT.IDENTIFIED,
          buyer: {
            documentType: command.documentType,
            documentNumber: command.documentNumber,
            name: lookup.name,
          },
          lookup: {
            name: lookup.name,
            email: lookup.email,
          },
        };
      default:
        return unsupportedLookup(lookup);
    }
  }
}

const genericAttachment = (taxpayerEmail: string): GenericAttachment => ({
  kind: ATTACH_BUYER_RESULT.GENERIC,
  buyer: {
    documentType: GENERIC_BUYER_IDENTITY.documentType,
    documentNumber: GENERIC_BUYER_IDENTITY.documentNumber,
    name: GENERIC_BUYER_IDENTITY.name,
    responsibility: GENERIC_BUYER_IDENTITY.responsibility,
    email: taxpayerEmail,
  },
});

const unsupportedLookup = (lookup: never): never => {
  throw new Error(`Unexpected acquirer lookup: ${JSON.stringify(lookup)}`);
};
