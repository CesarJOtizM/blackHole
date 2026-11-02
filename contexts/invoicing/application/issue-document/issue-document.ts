import type {
  DocumentIssuance,
  InvoicingProvider,
} from "#application/ports/invoicing-provider.js";
import type { QueuedClosureReader } from "#application/ports/queued-closure-reader.js";
import {
  DOCUMENT_HOLD_REASON,
  type SalesDocumentRepository,
  type StoredSalesDocument,
} from "#application/ports/sales-document-repository.js";
import {
  type CalculateTaxesInput,
  calculateTaxes,
  type TaxBreakdown,
} from "#domain/calculate-taxes.js";
import {
  createDocumentContent,
  type DocumentContent,
  type DocumentTaxRule,
} from "#domain/document-content.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
} from "#domain/sales-document.js";

export class QueuedClosureNotFound extends Error {
  constructor() {
    super("The queued closure does not exist.");
    this.name = "QueuedClosureNotFound";
  }
}

export class SaleBaseMismatch extends Error {
  constructor() {
    super("The document taxes do not match the sale total.");
    this.name = "SaleBaseMismatch";
  }
}

export interface IssueDocumentCommand {
  closureId: string;
  referenceCode: string;
  taxpayerEmail: string;
  documentBalance: number;
  rules: readonly DocumentTaxRule[];
  siteRangeId: string;
  registerRangeId?: string;
}

const sameSaleBase = (
  quoted: TaxBreakdown,
  content: DocumentContent,
): boolean =>
  quoted.lines.length === content.lines.length &&
  quoted.lines.every((line, index) => content.lines[index]?.base === line.base);

export class IssueDocument {
  constructor(
    private readonly closures: QueuedClosureReader,
    private readonly documents: SalesDocumentRepository,
    private readonly provider: InvoicingProvider<DocumentIssuance>,
    private readonly saleTaxes: (
      input: CalculateTaxesInput,
    ) => TaxBreakdown = calculateTaxes,
  ) {}

  async execute(command: IssueDocumentCommand): Promise<StoredSalesDocument> {
    const existing = await this.documents.findByClosureId(command.closureId);

    if (existing) {
      return existing;
    }

    const closure = await this.closures.read(command.closureId);

    if (!closure) {
      throw new QueuedClosureNotFound();
    }

    const quoted = this.saleTaxes({
      rules: command.rules,
      lines: closure.lines,
      paidCop: closure.saleCop,
    });
    const content = createDocumentContent({
      lines: closure.lines,
      rules: command.rules,
      payments: closure.payments,
      tipCop: closure.tipCop,
      siteRangeId: command.siteRangeId,
      registerRangeId: command.registerRangeId,
    });

    if (!sameSaleBase(quoted, content)) {
      throw new SaleBaseMismatch();
    }

    const created = createSalesDocument({
      closureId: closure.id,
      referenceCode: command.referenceCode,
      taxpayerEmail: command.taxpayerEmail,
    });

    if (command.documentBalance !== 0) {
      const issued = await this.provider.validate({
        referenceCode: created.referenceCode,
      });

      const sent: StoredSalesDocument = {
        document: {
          ...created,
          number: issued.number,
          cufe: issued.cufe,
          qr: issued.qr,
        },
        reason: null,
        content,
      };

      await this.documents.insert(sent);

      return sent;
    }

    const stored: StoredSalesDocument = {
      document: {
        closureId: created.closureId,
        referenceCode: created.referenceCode,
        status: SALES_DOCUMENT_STATUS.PENDING_ISSUANCE,
        buyer: created.buyer,
      },
      reason: DOCUMENT_HOLD_REASON.NO_BALANCE,
      content,
    };

    await this.documents.insert(stored);

    return stored;
  }
}
