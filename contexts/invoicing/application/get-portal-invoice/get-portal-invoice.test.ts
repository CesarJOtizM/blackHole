import { expect, it } from "vitest";

import {
  GetPortalInvoice,
  type GetPortalInvoiceCommand,
  PORTAL_INVOICE,
  type PortalInvoiceDocument,
} from "#application/get-portal-invoice/get-portal-invoice.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  type EvaluatedPortalLink,
  PORTAL_LINK_PURPOSE,
  type PortalAccount,
  revealPortalLink,
} from "#domain/portal-link.js";
import {
  REINVOICE_WINDOW_MODE,
  type ReinvoiceWindowMode,
} from "#domain/reinvoice-window.js";

const TENANT_ID = "tenant-a";
const OTHER_TENANT_ID = "tenant-b";
const VENUE_ID = "venue-a";
const CHECK_ID = "check-a";
const REFERENCE_CODE = "018f6b2e-7c3a-7b21-8c4d-9a0b1c2d3e4f";
const OTHER_REFERENCE = "018f6b2e-7c3a-7b21-8c4d-aaaaaaaaaaaa";
const INVOICE_NUMBER = "FV-200";
const OPEN_AT = "2026-11-05T18:00:00.000Z";
const CLOSED_AT = "2026-11-06T18:00:00.000Z";
const ISSUED_AT = "2026-11-05T15:00:00.000Z";
const EXPIRES_AT = "2026-12-01T00:00:00.000Z";
const PDF = Uint8Array.from([37, 80, 68, 70]);
const EMPTY = { outcome: PORTAL_INVOICE.EMPTY };
const IN_PROCESS = { outcome: PORTAL_INVOICE.IN_PROCESS };

const hidesAccount = (value: unknown): void => {
  const text = JSON.stringify(value);

  expect(text).not.toContain(TENANT_ID);
  expect(text).not.toContain(OTHER_TENANT_ID);
  expect(text).not.toContain(VENUE_ID);
  expect(text).not.toContain(CHECK_ID);
  expect(text).not.toContain(REFERENCE_CODE);
  expect(text).not.toContain(OTHER_REFERENCE);
  expect(text).not.toContain(INVOICE_NUMBER);
};

const account = (overrides: Partial<PortalAccount> = {}): PortalAccount => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  ...overrides,
});

const link = (
  overrides: Partial<EvaluatedPortalLink> = {},
): EvaluatedPortalLink => ({
  purpose: PORTAL_LINK_PURPOSE.INVOICE,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  expiresAt: EXPIRES_AT,
  ...overrides,
});

const pending = (): PortalInvoiceDocument => ({
  status: "pending",
  referenceCode: REFERENCE_CODE,
});

const accepted = (): PortalInvoiceDocument => ({
  status: "accepted",
  referenceCode: REFERENCE_CODE,
  number: INVOICE_NUMBER,
  issuedAt: ISSUED_AT,
});

class RecordingProvider extends InvoicingProvider {
  constructor(
    private readonly steps: string[],
    private readonly fail: boolean,
  ) {
    super();
  }

  override async validate(): Promise<void> {
    this.steps.push("validate");
  }

  override async downloadPdf(number: string): Promise<Uint8Array> {
    this.steps.push(`downloadPdf:${number}`);

    if (this.fail) {
      throw new Error("pdf failed");
    }

    return PDF;
  }

  mail(): void {
    this.steps.push("mail");
  }
}

const harness = (options?: {
  link?: Partial<EvaluatedPortalLink>;
  account?: Partial<PortalAccount>;
  at?: string;
  suffixAccepted?: boolean;
  document?: PortalInvoiceDocument | null;
  windowMode?: ReinvoiceWindowMode;
  referenceCode?: string;
  fail?: boolean;
}) => {
  const steps: string[] = [];
  const command: GetPortalInvoiceCommand = {
    link: link(options?.link),
    account: account(options?.account),
    at: options?.at ?? OPEN_AT,
    referenceCode: options?.referenceCode ?? REFERENCE_CODE,
    suffixAccepted: options?.suffixAccepted ?? true,
    document: options?.document === undefined ? accepted() : options.document,
    windowMode: options?.windowMode,
  };
  const useCase = new GetPortalInvoice(
    new RecordingProvider(steps, options?.fail ?? false),
  );

  return {
    steps,
    command,
    open: () => useCase.execute(command),
  };
};

it("given a visible invoice link whose /f/<referenceCode>.<hmac> suffix was accepted, when the document is still pending, then the portal says in process and does not download or mail", async () => {
  const run = harness({ document: pending() });

  const result = await run.open();

  expect(run.command.referenceCode).toBe(REFERENCE_CODE);
  expect(run.command.suffixAccepted).toBe(true);
  expect(`/f/${run.command.referenceCode}.hmac`).toBe(
    `/f/${REFERENCE_CODE}.hmac`,
  );
  expect(result).toEqual(IN_PROCESS);
  expect(run.steps).toEqual([]);
  expect(Object.hasOwn(InvoicingProvider.prototype, "mail")).toBe(false);
  hidesAccount(result);
});

it("given that invoice is accepted and the re-invoice window is open, when the customer opens /f/<referenceCode>.<hmac>, then downloadPdf returns those bytes once", async () => {
  const run = harness();

  const result = await run.open();

  expect(run.steps).toEqual([`downloadPdf:${INVOICE_NUMBER}`]);
  expect(result).toEqual({ outcome: PORTAL_INVOICE.READY, pdf: PDF });
  hidesAccount(result);
});

it("given a pre-bill whose invoice was already issued, when the customer opens its link, then data entry is refused and no account data is shown", async () => {
  const evaluated = link({ purpose: PORTAL_LINK_PURPOSE.PRE_BILL });
  const opened = account();
  const disclosure = revealPortalLink({
    link: evaluated,
    account: opened,
    at: OPEN_AT,
  });
  const run = harness({
    link: { purpose: PORTAL_LINK_PURPOSE.PRE_BILL },
    document: accepted(),
  });

  const result = await run.open();

  expect(disclosure).toEqual({
    outcome: "visible",
    purpose: PORTAL_LINK_PURPOSE.PRE_BILL,
    account: opened,
  });
  expect(result).toEqual(EMPTY);
  expect(run.steps).toEqual([]);
  hidesAccount(result);
});

it("given an expired instant, another account, a missing hmac suffix, a closed window, or another reference, when /f/<referenceCode>.<hmac> is opened, then the result is empty and downloadPdf is not called", async () => {
  const cases = [
    harness({ at: EXPIRES_AT }),
    harness({ account: { tenantId: OTHER_TENANT_ID } }),
    harness({ suffixAccepted: false, document: pending() }),
    harness({ at: CLOSED_AT }),
    harness({ windowMode: REINVOICE_WINDOW_MODE.OFF }),
    harness({ referenceCode: OTHER_REFERENCE }),
    harness({ document: null }),
  ];

  for (const run of cases) {
    const result = await run.open();

    expect(result).toEqual(EMPTY);
    expect(run.steps).toEqual([]);
    hidesAccount(result);
  }
});

it("given an accepted invoice inside the window, when downloadPdf fails, then the result is empty and no account field is revealed", async () => {
  const run = harness({ fail: true });

  const result = await run.open();

  expect(run.steps).toEqual([`downloadPdf:${INVOICE_NUMBER}`]);
  expect(result).toEqual(EMPTY);
  hidesAccount(result);
});
