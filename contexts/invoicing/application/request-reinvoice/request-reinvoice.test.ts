import { expect, it } from "vitest";
import {
  ACQUIRER_LOOKUP,
  type AcquirerLookup,
  InvoicingProvider,
  REFERENCE_LOOKUP,
  type ReferenceLookup,
} from "#application/ports/invoicing-provider.js";
import {
  REINVOICE_REQUEST_STATUS,
  REQUEST_REINVOICE,
  ReinvoiceRequestStore,
  RequestReinvoice,
  type RequestReinvoiceCommand,
  type StoredReinvoiceRequest,
} from "#application/request-reinvoice/request-reinvoice.js";
import { REINVOICE_WINDOW_MODE } from "#domain/reinvoice-window.js";

const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const INVOICE_NUMBER = "FV-200";
const OTHER_INVOICE_NUMBER = "FV-300";
const PAYLOAD = "consumer-final-line";
const ISSUED_BEFORE_BOGOTA_MIDNIGHT = "2026-11-05T04:30:00.000Z";
const AT_AFTER_BOGOTA_MIDNIGHT = "2026-11-05T05:30:00.000Z";
const ISSUED_BOGOTA_DAY_START = "2026-11-05T05:30:00.000Z";
const AT_SAME_BOGOTA_DAY = "2026-11-05T18:00:00.000Z";
const AT_BOGOTA_DAY_END = "2026-11-06T04:30:00.000Z";
const ISSUED_BEFORE_BOGOTA_MONTH = "2026-11-01T04:30:00.000Z";
const AT_AFTER_BOGOTA_MONTH = "2026-11-01T05:30:00.000Z";
const AT_EARLIER_SAME_BOGOTA_DAY = "2026-11-05T05:00:00.000Z";
const UNREADABLE = "not-a-time";
const LOG_METHODS = ["log", "info", "debug", "warn", "error"] as const;

const NO_PROVIDER_CALLS = {
  validate: 0,
  downloadPdf: 0,
  lookupAcquirer: 0,
  validateCreditNote: 0,
  findByReference: 0,
};

const consumerFinal = {
  number: INVOICE_NUMBER,
  issuedAt: ISSUED_BOGOTA_DAY_START,
  payload: PAYLOAD,
};

const command = (
  overrides: Partial<RequestReinvoiceCommand> = {},
): RequestReinvoiceCommand => ({
  companyId: COMPANY_ID,
  invoiceNumber: consumerFinal.number,
  issuedAt: consumerFinal.issuedAt,
  at: AT_SAME_BOGOTA_DAY,
  windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
  ...overrides,
});

const pending = (
  overrides: Partial<StoredReinvoiceRequest> = {},
): StoredReinvoiceRequest => ({
  companyId: COMPANY_ID,
  invoiceNumber: INVOICE_NUMBER,
  issuedAt: ISSUED_BOGOTA_DAY_START,
  requestedAt: AT_SAME_BOGOTA_DAY,
  status: REINVOICE_REQUEST_STATUS.PENDING,
  ...overrides,
});

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

class MemoryReinvoiceRequests extends ReinvoiceRequestStore {
  readonly saved: StoredReinvoiceRequest[] = [];
  private readonly rows = new Map<string, StoredReinvoiceRequest>();

  override async save(row: StoredReinvoiceRequest): Promise<void> {
    this.saved.push(row);
    this.rows.set(`${row.companyId}:${row.invoiceNumber}`, row);
  }

  override async find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredReinvoiceRequest | null> {
    return this.rows.get(`${companyId}:${invoiceNumber}`) ?? null;
  }
}

class CountingProvider extends InvoicingProvider {
  readonly calls = {
    validate: 0,
    downloadPdf: 0,
    lookupAcquirer: 0,
    validateCreditNote: 0,
    findByReference: 0,
  };

  override async validate(): Promise<void> {
    this.calls.validate += 1;
  }

  override async downloadPdf(): Promise<Uint8Array> {
    this.calls.downloadPdf += 1;

    return Uint8Array.from([]);
  }

  override async lookupAcquirer(): Promise<AcquirerLookup> {
    this.calls.lookupAcquirer += 1;

    return { outcome: ACQUIRER_LOOKUP.EMPTY };
  }

  override async validateCreditNote(): Promise<void> {
    this.calls.validateCreditNote += 1;
  }

  override async findByReference(): Promise<ReferenceLookup> {
    this.calls.findByReference += 1;

    return { outcome: REFERENCE_LOOKUP.EMPTY };
  }
}

const harness = () => {
  const requests = new MemoryReinvoiceRequests();
  const provider = new CountingProvider();
  const useCase = new RequestReinvoice(requests, provider);
  const logs: string[] = [];

  return {
    requests,
    provider,
    logs,
    request: async (overrides?: Partial<RequestReinvoiceCommand>) => {
      const watched = await watch(() => useCase.execute(command(overrides)));
      logs.push(watched.logs);

      return watched.result;
    },
  };
};

const keepsConsumerFinal = (logs: readonly string[]): void => {
  expect(consumerFinal).toEqual({
    number: INVOICE_NUMBER,
    issuedAt: ISSUED_BOGOTA_DAY_START,
    payload: PAYLOAD,
  });
  expect(logs.join("\n")).not.toContain(INVOICE_NUMBER);
  expect(logs.join("\n")).not.toContain(PAYLOAD);
};

it("given an invoice older than the window, the window off, or an unreadable instant, when re-invoicing is requested, then it is rejected without storing or contacting the provider", async () => {
  const cases = [
    {
      issuedAt: ISSUED_BEFORE_BOGOTA_MIDNIGHT,
      at: AT_AFTER_BOGOTA_MIDNIGHT,
      windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
    },
    {
      issuedAt: ISSUED_BEFORE_BOGOTA_MONTH,
      at: AT_AFTER_BOGOTA_MONTH,
      windowMode: REINVOICE_WINDOW_MODE.SAME_MONTH,
    },
    {
      issuedAt: ISSUED_BOGOTA_DAY_START,
      at: AT_BOGOTA_DAY_END,
      windowMode: REINVOICE_WINDOW_MODE.OFF,
    },
    {
      issuedAt: UNREADABLE,
      at: AT_SAME_BOGOTA_DAY,
      windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
    },
    {
      issuedAt: ISSUED_BOGOTA_DAY_START,
      at: UNREADABLE,
      windowMode: REINVOICE_WINDOW_MODE.SAME_MONTH,
    },
    {
      issuedAt: ISSUED_BOGOTA_DAY_START,
      at: AT_EARLIER_SAME_BOGOTA_DAY,
      windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
    },
  ];

  for (const overrides of cases) {
    const run = harness();

    const result = await run.request(overrides);

    expect(result).toEqual({ outcome: REQUEST_REINVOICE.REJECTED });
    expect(run.requests.saved).toEqual([]);
    expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toBeNull();
    expect(run.provider.calls).toEqual(NO_PROVIDER_CALLS);
    keepsConsumerFinal(run.logs);
  }
});

it("given a consumer-final invoice inside the same Bogota day, when re-invoicing is requested with same_day or the default mode, then one pending request is recorded and the provider is not called", async () => {
  const explicit = harness();
  const omitted = harness();

  const explicitResult = await explicit.request();
  const omittedResult = await omitted.request({ windowMode: undefined });

  expect(explicitResult).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(omittedResult).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(explicit.requests.saved).toEqual([pending()]);
  expect(omitted.requests.saved).toEqual([pending()]);
  expect(explicit.provider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(omitted.provider.calls).toEqual(NO_PROVIDER_CALLS);
  keepsConsumerFinal(explicit.logs);
  keepsConsumerFinal(omitted.logs);
});

it("given the same Bogota month across a Bogota date change, when the window is same_month, then the request is recorded, and the same_day default rejects it", async () => {
  const month = harness();
  const day = harness();
  const issuedAt = ISSUED_BEFORE_BOGOTA_MIDNIGHT;
  const at = AT_AFTER_BOGOTA_MIDNIGHT;

  const monthResult = await month.request({
    issuedAt,
    at,
    windowMode: REINVOICE_WINDOW_MODE.SAME_MONTH,
  });
  const dayResult = await day.request({
    issuedAt,
    at,
    windowMode: undefined,
  });

  expect(monthResult).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(month.requests.saved).toEqual([
    pending({
      issuedAt,
      requestedAt: at,
    }),
  ]);
  expect(month.provider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(dayResult).toEqual({ outcome: REQUEST_REINVOICE.REJECTED });
  expect(day.requests.saved).toEqual([]);
  expect(day.provider.calls).toEqual(NO_PROVIDER_CALLS);
  keepsConsumerFinal(month.logs);
  keepsConsumerFinal(day.logs);
});

it("given a pending request, when the same company asks again or another company has another invoice, then this company keeps one record", async () => {
  const run = harness();

  const first = await run.request();
  const second = await run.request({ at: AT_BOGOTA_DAY_END });
  const other = await run.request({
    companyId: OTHER_COMPANY_ID,
    invoiceNumber: OTHER_INVOICE_NUMBER,
  });

  expect(first).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(second).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(other).toEqual({ outcome: REQUEST_REINVOICE.RECORDED });
  expect(run.requests.saved).toEqual([
    pending(),
    pending({
      companyId: OTHER_COMPANY_ID,
      invoiceNumber: OTHER_INVOICE_NUMBER,
    }),
  ]);
  expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toEqual(
    pending(),
  );
  expect(await run.requests.find(OTHER_COMPANY_ID, INVOICE_NUMBER)).toBeNull();
  expect(await run.requests.find(COMPANY_ID, OTHER_INVOICE_NUMBER)).toBeNull();
  expect(run.provider.calls).toEqual(NO_PROVIDER_CALLS);
  keepsConsumerFinal(run.logs);
});
