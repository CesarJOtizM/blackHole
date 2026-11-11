import { expect, it } from "vitest";

import {
  OneTimeCodeDeliveryFailed,
  type OneTimeCodeMessage,
  OneTimeCodeSender,
} from "#application/ports/one-time-code-sender.js";
import {
  REMEMBERED_CODE_REQUEST,
  type RememberedContact,
  RememberedContactStore,
  RequestRememberedCode,
  type StoredOneTimeCode,
} from "#application/request-remembered-code/request-remembered-code.js";
import type { OneTimeCodeRecord } from "#domain/one-time-code.js";

const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const COMPANY_NAME = "Cafe Norte";
const DOCUMENT_TYPE = "13";
const DOCUMENT_NUMBER = "1234567890";
const AT = "2026-11-05T16:00:00.000Z";
const EXPIRES_AT = "2026-11-05T16:10:00.000Z";
const CODE = "482915";
const REGISTERED_EMAIL = "holder@example.com";
const REGISTERED_PHONE = "+573001112233";
const TYPED_EMAIL = "typed@other.test";
const TYPED_PHONE = "3000000000";
const HOLDER_NAME = "Ada Holder";
const OTHER_NAME = "Other Person";
const OTHER_DESTINATION = "other@example.com";
const FIND = `find:${COMPANY_ID}:${DOCUMENT_TYPE}:${DOCUMENT_NUMBER}`;
const HIDDEN = { outcome: REMEMBERED_CODE_REQUEST.HIDDEN };
const LOG_METHODS = ["log", "info", "debug", "warn", "error"] as const;

const fingerprint = (code: string): string =>
  `fp:${[...code].map((char) => String.fromCharCode(65 + Number(char))).join("")}`;

const digitsOf = (code: string): (() => number) => {
  const digits = [...code].map((char) => Number(char));
  let index = 0;

  return () => {
    const digit = digits[index];
    index += 1;

    if (digit === undefined) {
      throw new Error("No digit left.");
    }

    return digit;
  };
};

const contact = (
  overrides: Partial<RememberedContact> = {},
): RememberedContact => ({
  companyId: COMPANY_ID,
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  channel: "email",
  destination: REGISTERED_EMAIL,
  name: HOLDER_NAME,
  ...overrides,
});

const issuedRecord = (): OneTimeCodeRecord => ({
  digest: fingerprint(CODE),
  sentAt: AT,
  expiresAt: EXPIRES_AT,
  attemptsRemaining: 5,
  spent: false,
});

const message = (
  channel: OneTimeCodeMessage["channel"],
  destination: string,
): OneTimeCodeMessage => ({
  channel,
  destination,
  code: CODE,
  companyName: COMPANY_NAME,
  expiresInMinutes: 10,
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
  } catch (error) {
    return { logs: lines.join("\n"), error };
  } finally {
    LOG_METHODS.forEach((name, index) => {
      console[name] = prior[index] as typeof console.log;
    });
  }
};

class MemoryContacts extends RememberedContactStore {
  readonly saved: StoredOneTimeCode[] = [];

  constructor(
    private readonly steps: string[],
    private readonly seeded: RememberedContact | null,
  ) {
    super();
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<RememberedContact | null> {
    this.steps.push(`find:${companyId}:${documentType}:${documentNumber}`);
    return this.seeded;
  }

  override async save(row: StoredOneTimeCode): Promise<void> {
    this.steps.push(`save:${row.companyId}:${row.record.digest}`);
    this.saved.push(row);
  }
}

class RecordingSender extends OneTimeCodeSender {
  readonly sent: OneTimeCodeMessage[] = [];

  constructor(
    private readonly steps: string[],
    private readonly unconfigured: boolean,
  ) {
    super();
  }

  override async send(body: OneTimeCodeMessage): Promise<void> {
    this.steps.push(`send:${body.channel}:${body.destination}`);

    if (this.unconfigured) {
      throw new OneTimeCodeDeliveryFailed();
    }

    this.sent.push(body);
  }
}

const harness = (options?: {
  seeded?: RememberedContact | null;
  unconfigured?: boolean;
  typedDestination?: string;
}) => {
  const steps: string[] = [];
  const contacts = new MemoryContacts(
    steps,
    options?.seeded === undefined ? contact() : options.seeded,
  );
  const sender = new RecordingSender(steps, options?.unconfigured ?? false);
  const useCase = new RequestRememberedCode(
    contacts,
    sender,
    fingerprint,
    digitsOf(CODE),
  );

  return {
    steps,
    contacts,
    sender,
    run: () =>
      watch(() =>
        useCase.execute({
          companyId: COMPANY_ID,
          companyName: COMPANY_NAME,
          documentType: DOCUMENT_TYPE,
          documentNumber: DOCUMENT_NUMBER,
          at: AT,
          typedDestination: options?.typedDestination ?? TYPED_EMAIL,
        }),
      ),
  };
};

const hidesCode = (value: unknown): void => {
  const text = JSON.stringify(value);

  expect(text).not.toContain(CODE);
  expect(text).not.toContain(HOLDER_NAME);
  expect(text).not.toContain(OTHER_NAME);
  expect(text).not.toContain(OTHER_DESTINATION);
};

it("given a registered email or phone, when a code is requested with a typed destination, then the sender gets that contact, the company name, and ten minutes, and the clear code is not logged", async () => {
  const cases = [
    {
      channel: "email",
      destination: REGISTERED_EMAIL,
      typedDestination: TYPED_EMAIL,
    },
    {
      channel: "sms",
      destination: REGISTERED_PHONE,
      typedDestination: TYPED_PHONE,
    },
  ] as const;

  for (const item of cases) {
    const run = harness({
      seeded: contact({ channel: item.channel, destination: item.destination }),
      typedDestination: item.typedDestination,
    });

    const outcome = await run.run();

    expect(run.sender.sent).toEqual([message(item.channel, item.destination)]);
    expect(run.steps).toEqual([
      FIND,
      `send:${item.channel}:${item.destination}`,
      `save:${COMPANY_ID}:${fingerprint(CODE)}`,
    ]);
    expect(outcome.result).toEqual({ outcome: REMEMBERED_CODE_REQUEST.SENT });
    expect(run.contacts.saved).toEqual([
      {
        companyId: COMPANY_ID,
        documentType: DOCUMENT_TYPE,
        documentNumber: DOCUMENT_NUMBER,
        record: issuedRecord(),
      },
    ]);
    expect(outcome.logs).not.toContain(CODE);
    hidesCode(outcome.result);
    hidesCode(run.contacts.saved);
  }
});

it("given a remembered contact and an unconfigured sender, when a code is requested, then delivery fails, nothing is stored, and the clear code is not logged", async () => {
  const { steps, contacts, sender, run } = harness({ unconfigured: true });

  const outcome = await run();

  expect(outcome.error).toBeInstanceOf(OneTimeCodeDeliveryFailed);
  expect(outcome.result).toBeUndefined();
  expect(steps).toEqual([FIND, `send:email:${REGISTERED_EMAIL}`]);
  expect(contacts.saved).toEqual([]);
  expect(sender.sent).toEqual([]);
  expect(outcome.logs).not.toContain(CODE);
  expect(
    outcome.error instanceof Error ? outcome.error.message : "",
  ).not.toContain(CODE);
  hidesCode(steps);
  hidesCode(contacts.saved);
});

it("given another company's remembered contact or none, when this company requests a code, then the result is hidden and that contact is not sent", async () => {
  const otherCompany = harness({
    seeded: contact({
      companyId: OTHER_COMPANY_ID,
      destination: OTHER_DESTINATION,
      name: OTHER_NAME,
    }),
  });
  const missing = harness({ seeded: null });

  const otherOutcome = await otherCompany.run();
  const missingOutcome = await missing.run();

  expect(otherOutcome.result).toEqual(HIDDEN);
  expect(missingOutcome.result).toEqual(HIDDEN);
  expect(otherOutcome.error).toBeUndefined();
  expect(missingOutcome.error).toBeUndefined();
  expect(otherCompany.steps).toEqual([FIND]);
  expect(missing.steps).toEqual([FIND]);
  expect(otherCompany.sender.sent).toEqual([]);
  expect(missing.sender.sent).toEqual([]);
  expect(otherCompany.contacts.saved).toEqual([]);
  hidesCode(otherOutcome.result);
  hidesCode(otherCompany.steps);
  expect(otherOutcome.logs).not.toContain(OTHER_DESTINATION);
  expect(otherOutcome.logs).not.toContain(CODE);
});
