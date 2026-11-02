import type { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  REFERENCE_LOOKUP,
  type ReferenceLookup,
  ReferenceQueryFailed,
} from "#application/ports/invoicing-provider.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
} from "#domain/sales-document.js";

export const ISSUANCE_FOLLOW_UP = {
  NONE: "none",
  RESEND: "resend",
  BACKOFF: "backoff",
} as const;

export type IssuanceFollowUp =
  (typeof ISSUANCE_FOLLOW_UP)[keyof typeof ISSUANCE_FOLLOW_UP];

export interface VerifyIssuanceCommand {
  document: SalesDocument;
  replacementReferenceCode: string;
}

export interface VerifiedIssuance {
  document: SalesDocument;
  number: string | null;
  cufe: string | null;
  followUp: IssuanceFollowUp;
}

export abstract class RejectionAlert {
  abstract raise(referenceCode: string): Promise<void>;
}

const uncertain = (
  document: SalesDocument,
  followUp: IssuanceFollowUp,
): VerifiedIssuance => ({
  document: {
    ...document,
    status: SALES_DOCUMENT_STATUS.UNCERTAIN,
  },
  number: null,
  cufe: null,
  followUp,
});

const unsupportedLookup = (lookup: never): never => {
  throw new Error(`Unexpected reference lookup: ${JSON.stringify(lookup)}`);
};

export class VerifyIssuance {
  constructor(
    private readonly provider: InvoicingProvider,
    private readonly alerts: RejectionAlert,
  ) {}

  async execute(command: VerifyIssuanceCommand): Promise<VerifiedIssuance> {
    const document = command.document;
    let lookup: ReferenceLookup;

    try {
      lookup = await this.provider.findByReference(document.referenceCode);
    } catch (error) {
      if (!(error instanceof ReferenceQueryFailed)) {
        throw error;
      }

      return uncertain(document, ISSUANCE_FOLLOW_UP.BACKOFF);
    }

    switch (lookup.outcome) {
      case REFERENCE_LOOKUP.EMPTY:
        return uncertain(document, ISSUANCE_FOLLOW_UP.NONE);
      case REFERENCE_LOOKUP.VALIDATED:
        return {
          document: {
            ...document,
            status: SALES_DOCUMENT_STATUS.ACCEPTED,
          },
          number: lookup.number,
          cufe: lookup.cufe,
          followUp: ISSUANCE_FOLLOW_UP.NONE,
        };
      case REFERENCE_LOOKUP.PENDING:
        await this.provider.deleteAttempt(document.referenceCode);
        return this.resend(document, document.referenceCode);
      case REFERENCE_LOOKUP.MISSING:
        return this.resend(document, document.referenceCode);
      case REFERENCE_LOOKUP.REJECTED:
        await this.alerts.raise(document.referenceCode);
        return this.resend(
          createSalesDocument({
            closureId: document.closureId,
            referenceCode: command.replacementReferenceCode,
            taxpayerEmail: document.buyer.email,
          }),
          command.replacementReferenceCode,
        );
      default:
        return unsupportedLookup(lookup);
    }
  }

  private async resend(
    document: SalesDocument,
    referenceCode: string,
  ): Promise<VerifiedIssuance> {
    await this.provider.validate({ referenceCode });

    return {
      document: {
        ...document,
        referenceCode,
        status: SALES_DOCUMENT_STATUS.SENDING,
      },
      number: null,
      cufe: null,
      followUp: ISSUANCE_FOLLOW_UP.RESEND,
    };
  }
}
