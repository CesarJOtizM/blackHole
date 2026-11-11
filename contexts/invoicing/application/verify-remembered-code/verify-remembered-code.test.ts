import { expect, it } from "vitest";
import { CodeDigest } from "#application/ports/code-digest.js";
import {
  REMEMBERED_CODE_VERIFICATION,
  type RememberedBilling,
  RememberedCodeStore,
  type StoredRememberedCode,
  VerifyRememberedCode,
} from "#application/verify-remembered-code/verify-remembered-code.js";
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
const FIND = `find:${COMPANY_ID}:${DOCUMENT_TYPE}:${DOCUMENT_NUMBER}`;
const HIDDEN = { outcome: REMEMBERED_CODE_VERIFICATION.HIDDEN };

const fingerprint = (code: string): string =>
  `fp:${[...code].map((char) => String.fromCharCode(65 + Number(char))).join("")}`;

const billing = (
  overrides: Partial<RememberedBilling> = {},
): RememberedBilling => ({
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  personType: "natural",
  name: HOLDER_NAME,
  email: REGISTERED_EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
  ...overrides,
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

const stored = (
  overrides: Partial<StoredRememberedCode> = {},
): StoredRememberedCode => ({
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
  expect(text).not.toContain(DOCUMENT_NUMBER);
};

class MemoryCodes extends RememberedCodeStore {
  readonly saved: StoredRememberedCode[] = [];
  private current: StoredRememberedCode | null;

  constructor(
    private readonly steps: string[],
    seeded: StoredRememberedCode | null,
  ) {
    super();
    this.current = seeded;
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredRememberedCode | null> {
    this.steps.push(`find:${companyId}:${documentType}:${documentNumber}`);

    if (!this.current) {
      return null;
    }

    return {
      ...this.current,
      billing: { ...this.current.billing },
      record: { ...this.current.record },
    };
  }

  override async save(row: StoredRememberedCode): Promise<void> {
    this.steps.push(`save:${row.record.attemptsRemaining}:${row.record.spent}`);
    this.saved.push(row);
    this.current = row;
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

const harness = (options?: { seeded?: StoredRememberedCode | null }) => {
  const steps: string[] = [];
  const codes = new MemoryCodes(
    steps,
    options?.seeded === undefined ? stored() : options.seeded,
  );
  const useCase = new VerifyRememberedCode(codes, new MemoryDigest(steps));

  return {
    steps,
    codes,
    check: (code: string) =>
      useCase.execute({
        companyId: COMPANY_ID,
        documentType: DOCUMENT_TYPE,
        documentNumber: DOCUMENT_NUMBER,
        code,
        at: AT,
      }),
  };
};

it("given remembered billing and the received code, when the customer validates it, then the billing data is offered for confirmation and the code is spent", async () => {
  const run = harness();

  const result = await run.check(CODE);

  expect(result).toEqual({
    outcome: REMEMBERED_CODE_VERIFICATION.REVEALED,
    billing: billing(),
  });
  expect(run.steps).toEqual([
    FIND,
    `matches:${fingerprint(CODE)}`,
    "save:5:true",
  ]);
  expect(run.codes.saved).toEqual([
    stored({ record: record({ spent: true }) }),
  ]);
  expect(JSON.stringify(result)).not.toContain(CODE);
});

it("given only the ID, a missing record, or another company's contact, when no code is offered, then no billing data is revealed", async () => {
  const knownId = harness();
  const missing = harness({ seeded: null });
  const otherCompany = harness({
    seeded: stored({
      companyId: OTHER_COMPANY_ID,
      billing: billing({ name: OTHER_NAME, email: OTHER_EMAIL }),
    }),
  });

  const knownResult = await knownId.check("");
  const missingResult = await missing.check(CODE);
  const otherResult = await otherCompany.check(CODE);

  expect(knownResult).toEqual(HIDDEN);
  expect(missingResult).toEqual(HIDDEN);
  expect(otherResult).toEqual(HIDDEN);
  expect(knownId.steps).toEqual([FIND]);
  expect(missing.steps).toEqual([FIND]);
  expect(otherCompany.steps).toEqual([FIND]);
  expect(knownId.codes.saved).toEqual([]);
  expect(missing.codes.saved).toEqual([]);
  expect(otherCompany.codes.saved).toEqual([]);
  hidesBilling(knownResult);
  hidesBilling(missingResult);
  hidesBilling(otherResult);
});

it("given five remaining tries, when the fifth check is wrong, then the record locks and a later check reveals nothing", async () => {
  const run = harness();
  const results = [];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    results.push(await run.check(WRONG_CODE));
  }

  const later = await run.check(WRONG_CODE);

  expect(results).toEqual([HIDDEN, HIDDEN, HIDDEN, HIDDEN, HIDDEN]);
  expect(later).toEqual(HIDDEN);
  expect(run.codes.saved.map((row) => row.record.attemptsRemaining)).toEqual([
    4, 3, 2, 1, 0, 0,
  ]);
  expect(run.codes.saved.every((row) => row.record.spent === false)).toBe(true);
  expect(run.steps.filter((step) => step.startsWith("matches:"))).toHaveLength(
    5,
  );
  hidesBilling(later);
  hidesBilling(results);
});

it("given a spent code, when it is checked again, then nothing is revealed", async () => {
  const run = harness({ seeded: stored({ record: record({ spent: true }) }) });

  const result = await run.check(CODE);

  expect(result).toEqual(HIDDEN);
  expect(run.steps).toEqual([FIND, "save:5:true"]);
  expect(run.codes.saved).toEqual([
    stored({ record: record({ spent: true }) }),
  ]);
  hidesBilling(result);
});
