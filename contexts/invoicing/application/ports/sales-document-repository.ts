import type { DocumentContent } from "#domain/document-content.js";
import type { SalesDocument } from "#domain/sales-document.js";

export const DOCUMENT_HOLD_REASON = {
  NO_BALANCE: "no_balance",
} as const;

export type DocumentHoldReason =
  (typeof DOCUMENT_HOLD_REASON)[keyof typeof DOCUMENT_HOLD_REASON];

export interface StoredSalesDocument {
  document: SalesDocument;
  reason: DocumentHoldReason | null;
  content: DocumentContent;
}

export const SALES_DOCUMENT_DUPLICATE =
  "A closure already has a sales document.";

export abstract class SalesDocumentRepository {
  abstract findByClosureId(
    closureId: string,
  ): Promise<StoredSalesDocument | null>;

  abstract insert(stored: StoredSalesDocument): Promise<void>;
}
