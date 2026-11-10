import { expect, it } from "vitest";
import { CodeDigest } from "#application/ports/code-digest.js";
import {
  DATA_DELETION,
  DataDeletionStore,
  RequestDataDeletion,
  type StoredDataDeletion,
} from "#application/request-data-deletion/request-data-deletion.js";
import type { BillingDataRecord } from "#domain/billing-data.js";
import type { OneTimeCodeRecord } from "#domain/one-time-code.js";

const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const DOCUMENT_TYPE = "13";
const DOCUMENT_NUMBER = "1234567890";
const AT = "2026-11-05T16:00:00.000Z";
const EXPIRES_AT = "2026-11-05T16:10:00.000Z";
const CODE = "482915";
const WRONG_CODE = "000000";
const HOLDER_NAME = "Ada Holder";
const OTHER_NAME = "Other Person";
const REGISTERED_EMAIL = "holder@example.com";
const OTHER_EMAIL = "other@example.com";
const MUNICIPALITY_CODE = "11001";
const POLICY_VERSION = "2026-01";
const POLICY_LINK = "https://example.com/privacy";
const FIND = `find:${COMPANY_ID}:${DOCUMENT_TYPE}:${DOCUMENT_NUMBER}`;
const HIDDEN = { outcome: DATA_DELETION.HIDDEN };
const DELETED = { outcome: DATA_DELETION.DELETED };
const SNAPSHOTS: BillingDataRecord["invoiceSnapshots"] = [
  { number: "FV-100" },
  { number: "FV-101" },
];
const LOG_METHODS = ["log", "info", "debug", "warn", "error"] as const;

const fingerprint = (code: string): string =>
  `fp:${[...code].map((char) => String.fromCharCode(65 + Number(char))).join("")}`;

const billing = (
  overrides: Partial<BillingDataRecord> = {},
): BillingDataRecord => ({
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  personType: "natural",
  name: HOLDER_NAME,
  email: REGISTERED_EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
  consent: {
    acceptedAt: AT,
    policyVersion: POLICY_VERSION,
    policyLink: POLICY_LINK,
  },
  deletedAt: null,
  invoiceSnapshots: SNAPSHOTS.map((snapshot) => ({ number: snapshot.number })),
  ...overrides,
});

const offered = () => ({
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  personType: "natural",
  name: HOLDER_NAME,
  email: REGISTERED_EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
});

const record = (
  overrides: Partial<OneTimeCodeRecord> = {},
): OneTimeCodeRecord => ({
  digest: fingerprint(CODE),
  sentAt: AT,
  expiresAt: EXPIRES_AT,
  attemptsRemaining: 5,
  spent: false,
  ...overrides,
});

const subject = (
  overrides: Partial<StoredDataDeletion> = {},
): StoredDataDeletion => ({
  companyId: COMPANY_ID,
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  billing: billing(),
  record: record(),
  ...overrides,
});

const hidesBilling = (value: unknown): void => {
  const text = JSON.stringify(value);

  expect(text).not.toContain(CODE);
  expect(text).not.toContain(WRONG_CODE);
  expect(text).not.toContain(HOLDER_NAME);
  expect(text).not.toContain(OTHER_NAME);
  expect(text).not.toContain(REGISTERED_EMAIL);
  expect(text).not.toContain(OTHER_EMAIL);
  expect(text).not.toContain(MUNICIPALITY_CODE);
  expect(text).not.toContain(POLICY_LINK);
  expect(text).not.toContain("FV-100");
  expect(text).not.toContain("FV-101");
};

const watch = async <T>(body: () => Promise<T>) => {
  const lines: string[] = [];
  const prior = LOG_METHODS.map((name) => console[name]);

  for (const name of LOG_METHODS) {
    console[name] = ((...args: readonly unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(" "));
    }) as typeof console.log;
  }

  try {
    return { result: await body(), logs: lines.join("\n") };
  } finally {
    LOG_METHODS.forEach((name, index) => {
      console[name] = prior[index] as typeof console.log;
    });
  }
};

class MemoryRecords extends DataDeletionStore {
  readonly saved: StoredDataDeletion[] = [];
  private current: StoredDataDeletion | null;

  constructor(
    private readonly steps: string[],
    seeded: StoredDataDeletion | null,
  ) {
    super();
    this.current = seeded;
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredDataDeletion | null> {
    this.steps.push(`find:${companyId}:${documentType}:${documentNumber}`);

    if (!this.current) {
      return null;
    }

    return {
      ...this.current,
      billing: {
        ...this.current.billing,
        consent: { ...this.current.billing.consent },
        invoiceSnapshots: this.current.billing.invoiceSnapshots.map(
          (snapshot) => ({ number: snapshot.number }),
        ),
      },
      record: { ...this.current.record },
    };
  }

  override async save(row: StoredDataDeletion): Promise<void> {
    const copy: StoredDataDeletion = {
      ...row,
      billing: {
        ...row.billing,
        consent: { ...row.billing.consent },
        invoiceSnapshots: row.billing.invoiceSnapshots.map((snapshot) => ({
          number: snapshot.number,
        })),
      },
      record: { ...row.record },
    };

    this.steps.push(
      `save:${copy.record.attemptsRemaining}:${copy.record.spent}:${copy.billing.deletedAt ?? "null"}`,
    );
    this.saved.push(copy);
    this.current = copy;
  }
}

class MemoryDigest extends CodeDigest {
  constructor(private readonly steps: string[]) {
    super();
  }

  override matches(code: string, digest: string): boolean {
    this.steps.push(`matches:${digest}`);
    return digest === fingerprint(code);
  }
}

const harness = (options?: { seeded?: StoredDataDeletion | null }) => {
  const steps: string[] = [];
  const seeded = options?.seeded === undefined ? subject() : options.seeded;
  const records = new MemoryRecords(steps, seeded);
  const useCase = new RequestDataDeletion(records, new MemoryDigest(steps));
  const identity = {
    companyId: COMPANY_ID,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
  };

  return {
    steps,
    records,
    seeded,
    usable: () => useCase.findUsable(identity),
    delete: (code: string) => useCase.execute({ ...identity, code, at: AT }),
  };
};

it("given remembered billing and the received code, when deletion is requested, then future use stops and the invoice snapshots stay", async () => {
  const run = harness();
  const outcome = await watch(async () => {
    const before = await run.usable();
    const result = await run.delete(CODE);
    const after = await run.usable();

    return { before, result, after };
  });

  expect(outcome.result.before).toEqual(offered());
  expect(outcome.result.result).toEqual(DELETED);
  expect(outcome.result.after).toBeNull();
  expect(run.steps).toEqual([
    FIND,
    FIND,
    `matches:${fingerprint(CODE)}`,
    `save:5:true:${AT}`,
    FIND,
  ]);
  expect(run.records.saved).toEqual([
    subject({
      billing: billing({ deletedAt: AT }),
      record: record({ spent: true }),
    }),
  ]);
  expect(run.records.saved[0]?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(run.seeded?.billing.deletedAt).toBeNull();
  expect(run.seeded?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  hidesBilling(outcome.result.result);
  expect(outcome.logs).not.toContain(CODE);
  expect(outcome.logs).not.toContain(HOLDER_NAME);
  expect(outcome.logs).not.toContain(REGISTERED_EMAIL);
  expect(outcome.logs).not.toContain(POLICY_LINK);
});

it("given a blank code, a missing row, or another company's row, when deletion is requested, then nothing is deleted and no billing data is revealed", async () => {
  const blank = harness();
  const missing = harness({ seeded: null });
  const otherCompany = harness({
    seeded: subject({
      companyId: OTHER_COMPANY_ID,
      billing: billing({ name: OTHER_NAME, email: OTHER_EMAIL }),
    }),
  });

  const blankResult = await blank.delete("");
  const whitespaceResult = await blank.delete("   ");
  const missingResult = await missing.delete(CODE);
  const otherResult = await otherCompany.delete(CODE);

  expect(blankResult).toEqual(HIDDEN);
  expect(whitespaceResult).toEqual(HIDDEN);
  expect(missingResult).toEqual(HIDDEN);
  expect(otherResult).toEqual(HIDDEN);
  expect(blank.steps).toEqual([FIND, FIND]);
  expect(missing.steps).toEqual([FIND]);
  expect(otherCompany.steps).toEqual([FIND]);
  expect(blank.records.saved).toEqual([]);
  expect(missing.records.saved).toEqual([]);
  expect(otherCompany.records.saved).toEqual([]);
  expect(blank.seeded?.billing.deletedAt).toBeNull();
  expect(blank.seeded?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(await blank.usable()).toEqual(offered());
  hidesBilling(blankResult);
  hidesBilling(whitespaceResult);
  hidesBilling(missingResult);
  hidesBilling(otherResult);
});

it("given a wrong, locked, expired, or spent code, when deletion is requested, then the code record changes and the billing snapshots stay", async () => {
  const wrong = harness();
  const locked = harness({
    seeded: subject({ record: record({ attemptsRemaining: 0 }) }),
  });
  const expired = harness({
    seeded: subject({ record: record({ expiresAt: AT }) }),
  });
  const spent = harness({
    seeded: subject({ record: record({ spent: true }) }),
  });
  const outcome = await watch(async () => {
    const wrongResult = await wrong.delete(WRONG_CODE);
    const lockedResult = await locked.delete(CODE);
    const expiredResult = await expired.delete(CODE);
    const spentResult = await spent.delete(CODE);

    return { wrongResult, lockedResult, expiredResult, spentResult };
  });

  expect(outcome.result.wrongResult).toEqual(HIDDEN);
  expect(outcome.result.lockedResult).toEqual(HIDDEN);
  expect(outcome.result.expiredResult).toEqual(HIDDEN);
  expect(outcome.result.spentResult).toEqual(HIDDEN);
  expect(wrong.steps).toEqual([
    FIND,
    `matches:${fingerprint(CODE)}`,
    "save:4:false:null",
  ]);
  expect(locked.steps).toEqual([FIND, "save:0:false:null"]);
  expect(expired.steps).toEqual([FIND, "save:5:false:null"]);
  expect(spent.steps).toEqual([FIND, "save:5:true:null"]);
  expect(wrong.records.saved).toEqual([
    subject({ record: record({ attemptsRemaining: 4 }) }),
  ]);
  expect(locked.records.saved).toEqual([
    subject({ record: record({ attemptsRemaining: 0 }) }),
  ]);
  expect(expired.records.saved).toEqual([
    subject({ record: record({ expiresAt: AT }) }),
  ]);
  expect(spent.records.saved).toEqual([
    subject({ record: record({ spent: true }) }),
  ]);
  expect(wrong.records.saved[0]?.billing.deletedAt).toBeNull();
  expect(locked.records.saved[0]?.billing.deletedAt).toBeNull();
  expect(expired.records.saved[0]?.billing.deletedAt).toBeNull();
  expect(spent.records.saved[0]?.billing.deletedAt).toBeNull();
  expect(wrong.records.saved[0]?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(locked.records.saved[0]?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(expired.records.saved[0]?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(spent.records.saved[0]?.billing.invoiceSnapshots).toEqual(SNAPSHOTS);
  expect(await wrong.usable()).toEqual(offered());
  hidesBilling(outcome.result);
  expect(outcome.logs).not.toContain(CODE);
  expect(outcome.logs).not.toContain(WRONG_CODE);
  expect(outcome.logs).not.toContain(HOLDER_NAME);
  expect(outcome.logs).not.toContain(REGISTERED_EMAIL);
});
