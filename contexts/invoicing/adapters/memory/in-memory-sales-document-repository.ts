import {
  SALES_DOCUMENT_DUPLICATE,
  SalesDocumentRepository,
  type StoredSalesDocument,
} from "#application/ports/sales-document-repository.js";

interface SalesDocumentRecord {
  tenantId: string;
  stored: StoredSalesDocument;
}

const cloneStored = (stored: StoredSalesDocument): StoredSalesDocument =>
  structuredClone(stored);

export class SalesDocumentMemory {
  readonly records: SalesDocumentRecord[] = [];
}

export class InMemorySalesDocumentRepository extends SalesDocumentRepository {
  constructor(
    private readonly tenantId: string,
    private readonly memory: SalesDocumentMemory,
  ) {
    super();
  }

  override async findByClosureId(
    closureId: string,
  ): Promise<StoredSalesDocument | null> {
    const record = this.memory.records.find(
      (row) =>
        row.tenantId === this.tenantId &&
        row.stored.document.closureId === closureId,
    );

    return record === undefined ? null : cloneStored(record.stored);
  }

  override async insert(stored: StoredSalesDocument): Promise<void> {
    const duplicate = this.memory.records.some(
      (row) =>
        row.tenantId === this.tenantId &&
        row.stored.document.closureId === stored.document.closureId,
    );

    if (duplicate) {
      throw new Error(SALES_DOCUMENT_DUPLICATE);
    }

    this.memory.records.push({
      tenantId: this.tenantId,
      stored: cloneStored(stored),
    });
  }
}
