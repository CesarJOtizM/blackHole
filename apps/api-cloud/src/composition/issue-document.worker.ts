import { FactusInvoicingProvider } from "@blackhole/invoicing/adapters/factus/factus-invoicing-provider";
import {
  IssueDocument,
  type IssueDocumentCommand,
  QueuedClosureNotFound,
  QueuedClosureReader,
  SALES_DOCUMENT_DUPLICATE,
  SalesDocumentRepository,
  type StoredSalesDocument,
} from "@blackhole/invoicing/application/entry-port";
import type { Secrets } from "@blackhole/platform/application/entry-port";
import type { PgBoss } from "pg-boss";

export const ISSUE_DOCUMENT_QUEUE = "invoicing.issue-document";

export interface IssueDocumentWorkerJob {
  closureId: string;
  referenceCode: string;
  taxpayerEmail: string;
  documentBalance: number;
  rules: IssueDocumentCommand["rules"];
  siteRangeId: string;
  registerRangeId?: string;
}

export interface IssuedDocumentJob {
  number: string;
  cufe: string;
  qr: string;
}

export interface IssueDocumentPorts {
  closures?: QueuedClosureReader;
  documents?: SalesDocumentRepository;
}

const issuedJob = (document: {
  number?: string;
  cufe?: string;
  qr?: string;
}): IssuedDocumentJob | null => {
  if (
    document.number === undefined ||
    document.cufe === undefined ||
    document.qr === undefined
  ) {
    return null;
  }

  return {
    number: document.number,
    cufe: document.cufe,
    qr: document.qr,
  };
};

export const issueQueuedDocument = async (
  job: IssueDocumentWorkerJob,
  issue: IssueDocument,
): Promise<IssuedDocumentJob | null> => {
  try {
    const stored = await issue.execute({
      closureId: job.closureId,
      referenceCode: job.referenceCode,
      taxpayerEmail: job.taxpayerEmail,
      documentBalance: job.documentBalance,
      rules: job.rules,
      siteRangeId: job.siteRangeId,
      registerRangeId: job.registerRangeId,
    });

    return issuedJob(stored.document);
  } catch (error) {
    if (error instanceof QueuedClosureNotFound) {
      return null;
    }

    throw error;
  }
};

class AbsentQueuedClosures extends QueuedClosureReader {
  override read(): Promise<null> {
    return Promise.resolve(null);
  }
}

class ProcessSalesDocuments extends SalesDocumentRepository {
  private readonly rows: StoredSalesDocument[] = [];

  override async findByClosureId(
    closureId: string,
  ): Promise<StoredSalesDocument | null> {
    return (
      this.rows.find((row) => row.document.closureId === closureId) ?? null
    );
  }

  override async insert(stored: StoredSalesDocument): Promise<void> {
    const duplicate = this.rows.some(
      (row) => row.document.closureId === stored.document.closureId,
    );

    if (duplicate) {
      throw new Error(SALES_DOCUMENT_DUPLICATE);
    }

    this.rows.push(structuredClone(stored));
  }
}

const absentQueuedClosures = new AbsentQueuedClosures();

export const openIssueDocument = (
  secrets: Secrets,
  ports: IssueDocumentPorts = {},
): IssueDocument =>
  new IssueDocument(
    ports.closures ?? absentQueuedClosures,
    ports.documents ?? new ProcessSalesDocuments(),
    new FactusInvoicingProvider(secrets),
  );

export const registerIssueDocument = async (
  boss: PgBoss,
  issue: IssueDocument,
): Promise<void> => {
  await boss.createQueue(ISSUE_DOCUMENT_QUEUE, { retryLimit: 0 });
  await boss.work<IssueDocumentWorkerJob>(
    ISSUE_DOCUMENT_QUEUE,
    async (jobs) => {
      for (const job of jobs) {
        await issueQueuedDocument(job.data, issue);
      }
    },
  );
};
