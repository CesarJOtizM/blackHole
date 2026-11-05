import { expect, it } from "vitest";

import {
  type CachedAcquirer,
  LookUpPortalBuyer,
  PORTAL_LOOKUP_LINK,
  PortalBuyerLookupStore,
  PortalLookupLimiter,
  type StoredPortalLookup,
} from "#application/look-up-portal-buyer/look-up-portal-buyer.js";
import {
  AcquirerLookupFailed,
  type AcquirerQuery,
  InvoicingProvider,
} from "#application/ports/invoicing-provider.js";
import { maskEmail, maskName } from "#domain/masking.js";

const LOOKUP_ID = "lookup-1";
const COMPANY_TAX_ID = "900123456";
const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const DOCUMENT_TYPE = "13";
const DOCUMENT_NUMBER = "1234567890";
const AT = "2026-11-05T22:00:00.000Z";
const FULL_NAME = "Juan Perez";
const FULL_EMAIL = "juanperez@gmail.com";
const OTHER_NAME = "Secret Person";
const OTHER_EMAIL = "secret.person@gmail.com";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const HIDDEN = { outcome: "hidden" };
const READ = `readCache:${COMPANY_ID}:${DOCUMENT_TYPE}:${DOCUMENT_NUMBER}`;
const ACQUIRE = `acquire:${COMPANY_TAX_ID}:${AT}:60`;
const LOOKUP = `lookupAcquirer:${DOCUMENT_TYPE}:${DOCUMENT_NUMBER}`;

const earlier = (milliseconds: number): string =>
  new Date(Date.parse(AT) - milliseconds).toISOString();

const cachedRow = (
  overrides: Partial<CachedAcquirer> = {},
): CachedAcquirer => ({
  companyId: COMPANY_ID,
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  name: FULL_NAME,
  email: FULL_EMAIL,
  cachedAt: AT,
  ...overrides,
});

const found = (lookupId: string) => ({
  outcome: "found" as const,
  lookupId,
  maskedName: maskName(FULL_NAME),
  maskedEmail: maskEmail(FULL_EMAIL),
});

const cacheStep = (row: CachedAcquirer): string =>
  `saveCache:${row.companyId}:${row.name}:${row.email}:${row.cachedAt}`;

const lookupStep = (lookupId: string, name: string, email: string): string =>
  `saveLookup:${lookupId}:${COMPANY_ID}:${name}:${email}`;

class MemoryStore extends PortalBuyerLookupStore {
  constructor(
    private readonly steps: string[],
    private readonly seeded: CachedAcquirer | null,
  ) {
    super();
  }

  override async readCache(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<CachedAcquirer | null> {
    this.steps.push(`readCache:${companyId}:${documentType}:${documentNumber}`);
    return this.seeded;
  }

  override async saveCache(row: CachedAcquirer): Promise<void> {
    this.steps.push(cacheStep(row));
  }

  override async saveLookup(row: StoredPortalLookup): Promise<void> {
    this.steps.push(lookupStep(row.lookupId, row.name, row.email));
  }
}

class RecordingLimiter extends PortalLookupLimiter {
  constructor(
    private readonly steps: string[],
    private readonly refuse: boolean,
  ) {
    super();
  }

  override async acquire(
    taxId: string,
    at: string,
    ceiling: number,
  ): Promise<void> {
    this.steps.push(`acquire:${taxId}:${at}:${ceiling}`);

    if (this.refuse) {
      throw new Error("rate limited");
    }
  }
}

class RecordingProvider extends InvoicingProvider {
  constructor(
    private readonly steps: string[],
    private readonly mode: "found" | "empty" | "fail",
  ) {
    super();
  }

  override async validate(): Promise<void> {
    this.steps.push("validate");
  }

  async issue(): Promise<void> {
    this.steps.push("issue");
  }

  override async lookupAcquirer(query: AcquirerQuery) {
    this.steps.push(
      `lookupAcquirer:${query.documentType}:${query.documentNumber}`,
    );

    if (this.mode === "fail") {
      throw new AcquirerLookupFailed();
    }

    if (this.mode === "empty") {
      return { outcome: "empty" as const };
    }

    return { outcome: "found" as const, name: FULL_NAME, email: FULL_EMAIL };
  }
}

const harness = (options?: {
  link?: "hidden" | "visible";
  lookupId?: string;
  cached?: CachedAcquirer | null;
  provider?: "found" | "empty" | "fail";
  refuse?: boolean;
}) => {
  const steps: string[] = [];
  const useCase = new LookUpPortalBuyer(
    new MemoryStore(
      steps,
      options?.cached === undefined ? null : options.cached,
    ),
    new RecordingLimiter(steps, options?.refuse ?? false),
    new RecordingProvider(steps, options?.provider ?? "found"),
  );

  return {
    steps,
    run: () =>
      useCase.execute({
        lookupId: options?.lookupId ?? LOOKUP_ID,
        taxId: COMPANY_TAX_ID,
        companyId: COMPANY_ID,
        documentType: DOCUMENT_TYPE,
        documentNumber: DOCUMENT_NUMBER,
        at: AT,
        link: options?.link ?? PORTAL_LOOKUP_LINK.VISIBLE,
      }),
  };
};

const hidesIdentity = (value: unknown): void => {
  const text = JSON.stringify(value);

  expect(text).not.toContain(FULL_NAME);
  expect(text).not.toContain("juanperez");
  expect(text).not.toContain(OTHER_NAME);
  expect(text).not.toContain("secret.person");
};

it("given a visible link and no fresh cache, when the acquirer is known, then masks and the caller lookup id are returned and the full row stays stored", async () => {
  const { steps, run } = harness();

  const result = await run();

  expect(steps).toEqual([
    READ,
    ACQUIRE,
    LOOKUP,
    cacheStep(cachedRow()),
    lookupStep(LOOKUP_ID, FULL_NAME, FULL_EMAIL),
  ]);
  expect(steps).not.toContain("validate");
  expect(steps).not.toContain("issue");
  expect(result).toEqual(found(LOOKUP_ID));
  hidesIdentity(result);
});

it("given a hidden link, when a document is looked up, then nothing is called and the refusal is shapeless", async () => {
  const { steps, run } = harness({ link: PORTAL_LOOKUP_LINK.HIDDEN });

  expect(await run()).toEqual(HIDDEN);
  expect(steps).toEqual([]);
});

it("given a cache row 30 days old for this company, when the same document is looked up, then the limiter and the provider are skipped and a new lookup id is stored", async () => {
  const { steps, run } = harness({
    lookupId: "lookup-2",
    cached: cachedRow({ cachedAt: earlier(THIRTY_DAYS_MS) }),
  });

  const result = await run();

  expect(steps).toEqual([READ, lookupStep("lookup-2", FULL_NAME, FULL_EMAIL)]);
  expect(result).toEqual(found("lookup-2"));
  hidesIdentity(result);
});

it("given a cache row older than 30 days, when the document is looked up, then the row is a miss and the quota is acquired before the provider", async () => {
  const { steps, run } = harness({
    cached: cachedRow({ cachedAt: earlier(THIRTY_DAYS_MS + 1) }),
  });

  expect(await run()).toEqual(found(LOOKUP_ID));
  expect(steps).toEqual([
    READ,
    ACQUIRE,
    LOOKUP,
    cacheStep(cachedRow()),
    lookupStep(LOOKUP_ID, FULL_NAME, FULL_EMAIL),
  ]);
});

it("given another company's cached acquirer, when this company looks up the same document, then that row is a miss and its identity is not returned", async () => {
  const { steps, run } = harness({
    cached: cachedRow({
      companyId: OTHER_COMPANY_ID,
      name: OTHER_NAME,
      email: OTHER_EMAIL,
    }),
  });

  const result = await run();

  expect(steps).toEqual([
    READ,
    ACQUIRE,
    LOOKUP,
    cacheStep(cachedRow()),
    lookupStep(LOOKUP_ID, FULL_NAME, FULL_EMAIL),
  ]);
  expect(result).toEqual(found(LOOKUP_ID));
  hidesIdentity(result);
  expect(JSON.stringify(steps)).not.toContain(OTHER_NAME);
  expect(JSON.stringify(steps)).not.toContain("secret.person");
});

it("given the limiter refuses, the provider fails, the lookup is empty, or the company has no cache, when a document is looked up, then every refusal matches a hidden link and stores nothing", async () => {
  const refused = harness({ refuse: true });
  const failed = harness({ provider: "fail" });
  const empty = harness({ provider: "empty" });
  const unknownCompany = harness({ cached: null, provider: "empty" });

  expect(await refused.run()).toEqual(HIDDEN);
  expect(refused.steps).toEqual([READ, ACQUIRE]);
  expect(await failed.run()).toEqual(HIDDEN);
  expect(await empty.run()).toEqual(HIDDEN);
  expect(await unknownCompany.run()).toEqual(HIDDEN);
  expect(failed.steps).toEqual([READ, ACQUIRE, LOOKUP]);
  expect(empty.steps).toEqual(failed.steps);
  expect(unknownCompany.steps).toEqual(failed.steps);

  for (const steps of [refused.steps, failed.steps, empty.steps]) {
    expect(steps).not.toContain("validate");
    expect(steps).not.toContain("issue");
    hidesIdentity(steps);
  }
});
