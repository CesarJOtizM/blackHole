import type { BillingDataNotifier } from "#application/ports/billing-data-notifier.js";
import type { MunicipalityCatalog } from "#application/ports/municipality-catalog.js";
import {
  type BillingConsentDraft,
  type BillingDataRecord,
  recordBillingData,
} from "#domain/billing-data.js";
import { InvalidNitCheckDigit } from "#domain/sales-document.js";

export const RECORD_BILLING_DATA = {
  FIELD_ERROR: "field_error",
  NOT_STORED: "not_stored",
  STORED: "stored",
} as const;

export const BILLING_DATA_DOCUMENT_FIELD = "documentNumber" as const;

export interface RecordBillingDataCommand {
  companyId: string;
  checkId: string;
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
  consent?: BillingConsentDraft;
  at: string;
}

export interface StoredBillingData {
  companyId: string;
  checkId: string;
  record: BillingDataRecord;
}

export type RecordBillingDataResult =
  | {
      outcome: typeof RECORD_BILLING_DATA.FIELD_ERROR;
      field: typeof BILLING_DATA_DOCUMENT_FIELD;
    }
  | { outcome: typeof RECORD_BILLING_DATA.NOT_STORED }
  | { outcome: typeof RECORD_BILLING_DATA.STORED; record: BillingDataRecord };

export abstract class BillingDataStore {
  abstract save(row: StoredBillingData): Promise<void>;

  abstract find(
    companyId: string,
    checkId: string,
  ): Promise<StoredBillingData | null>;
}

const fieldError = (): RecordBillingDataResult => ({
  outcome: RECORD_BILLING_DATA.FIELD_ERROR,
  field: BILLING_DATA_DOCUMENT_FIELD,
});

export class RecordBillingData {
  constructor(
    private readonly records: BillingDataStore,
    private readonly municipalities: MunicipalityCatalog,
    private readonly notifier: BillingDataNotifier,
  ) {}

  async execute(
    command: RecordBillingDataCommand,
  ): Promise<RecordBillingDataResult> {
    const municipalityCode = await this.municipalities.find(
      command.municipalityCode,
    );

    if (municipalityCode === null) {
      return { outcome: RECORD_BILLING_DATA.NOT_STORED };
    }
    let record: BillingDataRecord | undefined;

    try {
      record = recordBillingData({
        documentType: command.documentType,
        documentNumber: command.documentNumber,
        personType: command.personType,
        name: command.name,
        email: command.email,
        municipalityCode,
        consent: command.consent,
        at: command.at,
      });
    } catch (error) {
      if (error instanceof InvalidNitCheckDigit) {
        return fieldError();
      }

      throw error;
    }

    if (record === undefined) {
      return { outcome: RECORD_BILLING_DATA.NOT_STORED };
    }

    await this.records.save({
      companyId: command.companyId,
      checkId: command.checkId,
      record,
    });
    await this.notifier.billingDataReceived({ checkId: command.checkId });

    return { outcome: RECORD_BILLING_DATA.STORED, record };
  }
}
