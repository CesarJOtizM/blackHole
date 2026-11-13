import { expect, it } from "vitest";
import type { BillingDataNotice } from "#application/ports/billing-data-notifier.js";
import { BillingDataNotifier } from "#application/ports/billing-data-notifier.js";
import { MunicipalityCatalog } from "#application/ports/municipality-catalog.js";
import {
  BILLING_DATA_DOCUMENT_FIELD,
  BillingDataStore,
  RECORD_BILLING_DATA,
  RecordBillingData,
  type RecordBillingDataCommand,
  type StoredBillingData,
} from "#application/record-billing-data/record-billing-data.js";

const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const CHECK_ID = "check-1";
const AT = "2026-11-05T16:00:00.000Z";
const VALID_NIT = "890903938-8";
const INVALID_NIT = "890903938-7";
const NIT_DOCUMENT_TYPE = "31";
const POLICY_VERSION = "2026-01";
const POLICY_LINK = "https://example.com/privacy";
const EMAIL = "buyer@example.com";
const MUNICIPALITY_CODE = "11001";
const UNKNOWN_MUNICIPALITY_CODE = "99999";
const NAME = "Ada Lovelace";

const storedRecord = (
  overrides: Partial<StoredBillingData["record"]> = {},
): StoredBillingData["record"] => ({
  documentType: NIT_DOCUMENT_TYPE,
  documentNumber: VALID_NIT,
  personType: "natural",
  name: NAME,
  email: EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
  consent: {
    acceptedAt: AT,
    policyVersion: POLICY_VERSION,
    policyLink: POLICY_LINK,
  },
  deletedAt: null,
  invoiceSnapshots: [],
  ...overrides,
});

const command = (
  overrides: Partial<RecordBillingDataCommand> = {},
): RecordBillingDataCommand => ({
  companyId: COMPANY_ID,
  checkId: CHECK_ID,
  documentType: NIT_DOCUMENT_TYPE,
  documentNumber: VALID_NIT,
  personType: "natural",
  name: NAME,
  email: EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
  consent: {
    accepted: true,
    policyVersion: POLICY_VERSION,
    policyLink: POLICY_LINK,
  },
  at: AT,
  ...overrides,
});

class MemoryBillingData extends BillingDataStore {
  readonly saved: StoredBillingData[] = [];
  private readonly rows = new Map<string, StoredBillingData>();

  constructor(private readonly steps: string[]) {
    super();
  }

  override async save(row: StoredBillingData): Promise<void> {
    this.steps.push(`save:${row.companyId}:${row.checkId}`);
    this.saved.push(row);
    this.rows.set(`${row.companyId}:${row.checkId}`, row);
  }

  override async find(
    companyId: string,
    checkId: string,
  ): Promise<StoredBillingData | null> {
    return this.rows.get(`${companyId}:${checkId}`) ?? null;
  }
}

class MemoryCatalog extends MunicipalityCatalog {
  constructor(
    private readonly steps: string[],
    private readonly known: ReadonlySet<string>,
  ) {
    super();
  }

  override async find(code: string): Promise<string | null> {
    this.steps.push(`catalog:${code}`);

    return this.known.has(code) ? code : null;
  }
}

class MemoryNotifier extends BillingDataNotifier {
  readonly notices: BillingDataNotice[] = [];

  constructor(private readonly steps: string[]) {
    super();
  }

  override async billingDataReceived(notice: BillingDataNotice): Promise<void> {
    this.steps.push(`notify:${notice.checkId}`);
    this.notices.push(notice);
  }
}

const harness = (known: readonly string[] = [MUNICIPALITY_CODE]) => {
  const steps: string[] = [];
  const records = new MemoryBillingData(steps);
  const notifier = new MemoryNotifier(steps);
  const useCase = new RecordBillingData(
    records,
    new MemoryCatalog(steps, new Set(known)),
    notifier,
  );

  return {
    steps,
    records,
    notifier,
    submit: (overrides?: Partial<RecordBillingDataCommand>) =>
      useCase.execute(command(overrides)),
  };
};

it("given a NIT with a wrong check digit, when billing data is submitted, then the document number is a field error and nothing is stored", async () => {
  const run = harness();

  const result = await run.submit({
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: INVALID_NIT,
  });

  expect(result).toEqual({
    outcome: RECORD_BILLING_DATA.FIELD_ERROR,
    field: BILLING_DATA_DOCUMENT_FIELD,
  });
  expect(run.steps).toEqual([`catalog:${MUNICIPALITY_CODE}`]);
  expect(run.records.saved).toEqual([]);
  expect(await run.records.find(COMPANY_ID, CHECK_ID)).toBeNull();
  expect(run.notifier.notices).toEqual([]);
});

it("given valid billing data without an accepted policy, when it is submitted, then nothing is stored and the register is not notified", async () => {
  const run = harness();

  const result = await run.submit({
    consent: {
      accepted: false,
      policyVersion: POLICY_VERSION,
      policyLink: POLICY_LINK,
    },
  });

  expect(result).toEqual({ outcome: RECORD_BILLING_DATA.NOT_STORED });
  expect(run.steps).toEqual([`catalog:${MUNICIPALITY_CODE}`]);
  expect(run.records.saved).toEqual([]);
  expect(await run.records.find(COMPANY_ID, CHECK_ID)).toBeNull();
  expect(run.notifier.notices).toEqual([]);
});

it("given accepted consent, when billing data is stored, then the consent date, policy, and link are kept for that company and the register is notified once", async () => {
  const run = harness();

  const result = await run.submit();

  expect(result).toEqual({
    outcome: RECORD_BILLING_DATA.STORED,
    record: storedRecord(),
  });
  expect(run.steps).toEqual([
    `catalog:${MUNICIPALITY_CODE}`,
    `save:${COMPANY_ID}:${CHECK_ID}`,
    `notify:${CHECK_ID}`,
  ]);
  expect(await run.records.find(COMPANY_ID, CHECK_ID)).toEqual({
    companyId: COMPANY_ID,
    checkId: CHECK_ID,
    record: storedRecord(),
  });
  expect(await run.records.find(OTHER_COMPANY_ID, CHECK_ID)).toBeNull();
  expect(run.notifier.notices).toEqual([{ checkId: CHECK_ID }]);
});

it("given an unknown DANE code and accepted consent, when billing data is submitted, then nothing is stored and the register is not notified", async () => {
  const run = harness([]);

  const result = await run.submit({
    municipalityCode: UNKNOWN_MUNICIPALITY_CODE,
  });

  expect(result).toEqual({ outcome: RECORD_BILLING_DATA.NOT_STORED });
  expect(run.steps).toEqual([`catalog:${UNKNOWN_MUNICIPALITY_CODE}`]);
  expect(run.records.saved).toEqual([]);
  expect(await run.records.find(COMPANY_ID, CHECK_ID)).toBeNull();
  expect(run.notifier.notices).toEqual([]);
});
