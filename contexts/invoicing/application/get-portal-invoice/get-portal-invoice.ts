import type { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  type EvaluatedPortalLink,
  PORTAL_LINK_PURPOSE,
  type PortalAccount,
  revealPortalLink,
} from "#domain/portal-link.js";
import {
  isReinvoiceWindowOpen,
  type ReinvoiceWindowMode,
} from "#domain/reinvoice-window.js";

export const PORTAL_INVOICE = {
  EMPTY: "empty",
  IN_PROCESS: "in_process",
  READY: "ready",
} as const;

export const PORTAL_INVOICE_DOCUMENT = {
  PENDING: "pending",
  ACCEPTED: "accepted",
} as const;

export type PortalInvoiceDocument =
  | {
      status: typeof PORTAL_INVOICE_DOCUMENT.PENDING;
      referenceCode: string;
    }
  | {
      status: typeof PORTAL_INVOICE_DOCUMENT.ACCEPTED;
      referenceCode: string;
      number: string;
      issuedAt: string;
    };

export interface GetPortalInvoiceCommand {
  link: EvaluatedPortalLink;
  account: PortalAccount;
  at: string;
  referenceCode: string;
  suffixAccepted: boolean;
  document: PortalInvoiceDocument | null;
  windowMode?: ReinvoiceWindowMode;
}

export type GetPortalInvoiceResult =
  | { outcome: typeof PORTAL_INVOICE.EMPTY }
  | { outcome: typeof PORTAL_INVOICE.IN_PROCESS }
  | { outcome: typeof PORTAL_INVOICE.READY; pdf: Uint8Array };

const empty = (): GetPortalInvoiceResult => ({
  outcome: PORTAL_INVOICE.EMPTY,
});

const sameReference = (
  document: PortalInvoiceDocument,
  referenceCode: string,
): boolean => document.referenceCode === referenceCode;

export class GetPortalInvoice {
  constructor(private readonly provider: InvoicingProvider) {}

  async execute(
    command: GetPortalInvoiceCommand,
  ): Promise<GetPortalInvoiceResult> {
    const disclosure = revealPortalLink({
      link: command.link,
      account: command.account,
      at: command.at,
    });

    if (disclosure.outcome !== "visible" || !command.suffixAccepted) {
      return empty();
    }

    if (disclosure.purpose !== PORTAL_LINK_PURPOSE.INVOICE) {
      return empty();
    }

    const document = command.document;

    if (document === null || !sameReference(document, command.referenceCode)) {
      return empty();
    }

    if (document.status === PORTAL_INVOICE_DOCUMENT.PENDING) {
      return { outcome: PORTAL_INVOICE.IN_PROCESS };
    }

    const windowOpen = isReinvoiceWindowOpen({
      issuedAt: document.issuedAt,
      at: command.at,
      mode: command.windowMode,
    });

    if (!windowOpen) {
      return empty();
    }

    try {
      const pdf = await this.provider.downloadPdf(document.number);

      return { outcome: PORTAL_INVOICE.READY, pdf };
    } catch {
      return empty();
    }
  }
}
