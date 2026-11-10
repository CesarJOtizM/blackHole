import type { CodeDigest } from "#application/ports/code-digest.js";
import {
  type BillingDataRecord,
  deleteBillingData,
} from "#domain/billing-data.js";
import {
  type OneTimeCodeDigest,
  type OneTimeCodeRecord,
  verifyOneTimeCode,
} from "#domain/one-time-code.js";

export const DATA_DELETION = {
  DELETED: "deleted",
  HIDDEN: "hidden",
} as const;

export interface OfferedBillingData {
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
}

export interface StoredDataDeletion {
  companyId: string;
  documentType: string;
  documentNumber: string;
  billing: BillingDataRecord;
  record: OneTimeCodeRecord;
}

export interface RequestDataDeletionCommand {
  companyId: string;
  documentType: string;
  documentNumber: string;
  code: string;
  at: string;
}

export type RequestDataDeletionResult =
  | { outcome: typeof DATA_DELETION.HIDDEN }
  | { outcome: typeof DATA_DELETION.DELETED };

export abstract class DataDeletionStore {
  abstract find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredDataDeletion | null>;

  abstract save(row: StoredDataDeletion): Promise<void>;
}

const hidden = (): RequestDataDeletionResult => ({
  outcome: DATA_DELETION.HIDDEN,
});

const sameHolder = (
  row: StoredDataDeletion,
  command: Pick<
    RequestDataDeletionCommand,
    "companyId" | "documentType" | "documentNumber"
  >,
): boolean =>
  row.companyId === command.companyId &&
  row.documentType === command.documentType &&
  row.documentNumber === command.documentNumber &&
  row.billing.documentType === command.documentType &&
  row.billing.documentNumber === command.documentNumber;

const compared =
  (digests: CodeDigest, stored: string): OneTimeCodeDigest =>
  (code) =>
    digests.matches(code, stored) ? stored : `${stored}:miss`;

const offeredFrom = (row: StoredDataDeletion): OfferedBillingData => ({
  documentType: row.billing.documentType,
  documentNumber: row.billing.documentNumber,
  personType: row.billing.personType,
  name: row.billing.name,
  email: row.billing.email,
  municipalityCode: row.billing.municipalityCode,
});

export class RequestDataDeletion {
  constructor(
    private readonly records: DataDeletionStore,
    private readonly digests: CodeDigest,
  ) {}

  async findUsable(
    command: Pick<
      RequestDataDeletionCommand,
      "companyId" | "documentType" | "documentNumber"
    >,
  ): Promise<OfferedBillingData | null> {
    const row = await this.records.find(
      command.companyId,
      command.documentType,
      command.documentNumber,
    );

    if (!row || !sameHolder(row, command) || row.billing.deletedAt !== null) {
      return null;
    }

    return offeredFrom(row);
  }

  async execute(
    command: RequestDataDeletionCommand,
  ): Promise<RequestDataDeletionResult> {
    const row = await this.records.find(
      command.companyId,
      command.documentType,
      command.documentNumber,
    );

    if (!row || !sameHolder(row, command) || command.code.trim().length === 0) {
      return hidden();
    }

    const verification = verifyOneTimeCode({
      record: row.record,
      code: command.code,
      digest: compared(this.digests, row.record.digest),
      at: command.at,
    });

    if (verification.outcome !== "accepted") {
      await this.records.save({ ...row, record: verification.record });

      return hidden();
    }

    await this.records.save({
      ...row,
      billing: deleteBillingData({ record: row.billing, at: command.at }),
      record: verification.record,
    });

    return { outcome: DATA_DELETION.DELETED };
  }
}
