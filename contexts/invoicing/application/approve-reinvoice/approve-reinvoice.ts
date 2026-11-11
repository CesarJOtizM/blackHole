import {
  CREDIT_NOTE_OUTCOME,
  type IssueCreditNote,
  type IssueCreditNoteCommand,
} from "#application/issue-credit-note/issue-credit-note.js";
import type {
  IssueDocument,
  IssueDocumentCommand,
} from "#application/issue-document/issue-document.js";
import {
  PORTAL_REINVOICE_REQUEST_STATUS,
  type PortalRepository,
} from "#application/ports/portal-repository.js";
import {
  isReinvoiceWindowOpen,
  type ReinvoiceWindowMode,
} from "#domain/reinvoice-window.js";
import type { SalesDocument } from "#domain/sales-document.js";

export const APPROVE_REINVOICE = {
  DENIED: "denied",
  REJECTED: "rejected",
  APPROVED: "approved",
} as const;

export interface ApproveReinvoiceCommand {
  companyId: string;
  invoiceNumber: string;
  at: string;
  windowMode?: ReinvoiceWindowMode;
  permissions: readonly string[];
  original: SalesDocument;
  creditNote: Omit<IssueCreditNoteCommand, "permissions" | "original">;
  invoice: IssueDocumentCommand;
}

export type ApproveReinvoiceResult =
  | { outcome: typeof APPROVE_REINVOICE.DENIED }
  | { outcome: typeof APPROVE_REINVOICE.REJECTED }
  | { outcome: typeof APPROVE_REINVOICE.APPROVED };

const rejected = (): ApproveReinvoiceResult => ({
  outcome: APPROVE_REINVOICE.REJECTED,
});

const denied = (): ApproveReinvoiceResult => ({
  outcome: APPROVE_REINVOICE.DENIED,
});

export class ApproveReinvoice {
  constructor(
    private readonly requests: PortalRepository,
    private readonly creditNotes: IssueCreditNote,
    private readonly invoices: IssueDocument,
  ) {}

  async execute(
    command: ApproveReinvoiceCommand,
  ): Promise<ApproveReinvoiceResult> {
    const stored = await this.requests.find(
      command.companyId,
      command.invoiceNumber,
    );

    if (
      stored === null ||
      stored.status !== PORTAL_REINVOICE_REQUEST_STATUS.PENDING ||
      stored.companyId !== command.companyId ||
      stored.invoiceNumber !== command.invoiceNumber
    ) {
      return rejected();
    }

    const open = isReinvoiceWindowOpen({
      issuedAt: stored.issuedAt,
      at: command.at,
      mode: command.windowMode,
    });

    if (!open) {
      return rejected();
    }

    const issued = await this.creditNotes.execute({
      ...command.creditNote,
      permissions: command.permissions,
      original: command.original,
    });

    if (issued.outcome !== CREDIT_NOTE_OUTCOME.ISSUED) {
      return denied();
    }

    await this.invoices.execute(command.invoice);
    await this.requests.save({
      ...stored,
      status: PORTAL_REINVOICE_REQUEST_STATUS.APPROVED,
    });

    return { outcome: APPROVE_REINVOICE.APPROVED };
  }
}
