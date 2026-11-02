import { PERMISSION } from "@blackhole/platform/application/entry-port";

import type { CreditNoteAudit } from "#application/ports/credit-note-audit.js";
import type { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import type { SalesDocument } from "#domain/sales-document.js";

export const CREDIT_NOTE_STATUS = {
  GENERATED: "generated",
} as const;

export type CreditNoteStatus =
  (typeof CREDIT_NOTE_STATUS)[keyof typeof CREDIT_NOTE_STATUS];

export const CREDIT_NOTE_OUTCOME = {
  ISSUED: "issued",
  DENIED: "denied",
} as const;

export interface CreditNote {
  referenceCode: string;
  originalReferenceCode: string;
  status: CreditNoteStatus;
}

export interface IssuedCreditNote {
  outcome: typeof CREDIT_NOTE_OUTCOME.ISSUED;
  note: CreditNote;
}

export interface DeniedCreditNote {
  outcome: typeof CREDIT_NOTE_OUTCOME.DENIED;
}

export type IssueCreditNoteResult = IssuedCreditNote | DeniedCreditNote;

export interface IssueCreditNoteCommand {
  permissions: readonly string[];
  original: SalesDocument;
  referenceCode: string;
  tenantId: string;
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  siteId: string;
  reason: string;
}

export abstract class CreditNoteRepository {
  abstract insert(note: CreditNote): Promise<void>;
}

export class IssueCreditNote {
  constructor(
    private readonly provider: InvoicingProvider,
    private readonly notes: CreditNoteRepository,
    private readonly audits: CreditNoteAudit,
  ) {}

  async execute(
    command: IssueCreditNoteCommand,
  ): Promise<IssueCreditNoteResult> {
    if (!command.permissions.includes(PERMISSION.SALE_CREDIT_NOTE)) {
      return { outcome: CREDIT_NOTE_OUTCOME.DENIED };
    }

    const note: CreditNote = {
      referenceCode: command.referenceCode,
      originalReferenceCode: command.original.referenceCode,
      status: CREDIT_NOTE_STATUS.GENERATED,
    };

    await this.provider.validateCreditNote({
      referenceCode: note.referenceCode,
      originalReferenceCode: note.originalReferenceCode,
    });
    await this.notes.insert(note);
    await this.audits.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.siteId,
      action: PERMISSION.SALE_CREDIT_NOTE,
      entity: note.referenceCode,
      before: command.original.referenceCode,
      after: note.referenceCode,
      reason: command.reason,
    });

    return { outcome: CREDIT_NOTE_OUTCOME.ISSUED, note };
  }
}
