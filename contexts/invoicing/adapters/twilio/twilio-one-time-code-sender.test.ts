import { Secrets } from "@blackhole/platform/application/entry-port";
import { afterEach, expect, it, vi } from "vitest";

import { TwilioOneTimeCodeSender } from "#adapters/twilio/twilio-one-time-code-sender.js";
import { oneTimeCodeSenderContract } from "#application/ports/one-time-code-sender.contract.js";
import {
  OneTimeCodeDeliveryFailed,
  type OneTimeCodeMessage,
  OneTimeCodeSender,
} from "#application/ports/one-time-code-sender.js";

const ACCOUNT_SID = "ACrecordedaccountsid";
const AUTH_TOKEN = "recorded-auth-token";
const SMS_FROM = "+573001112233";
const API_KEY = "SG.recorded-key";
const FROM_EMAIL = "portal@example.com";
const CODE = "482915";
const COMPANY = "Cafe Norte";
const MINUTES = 10;
const TEXT = `${COMPANY} code ${CODE}. It expires in ${MINUTES} minutes.`;
const MESSAGES_URL = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
const MAIL_URL = "https://api.sendgrid.com/v3/mail/send";

const DECOY = {
  TWILIO_ACCOUNT_SID: "env-account-sid",
  TWILIO_AUTH_TOKEN: "env-auth-token",
  TWILIO_SMS_FROM: "env-sms-from",
  SENDGRID_API_KEY: "env-api-key",
  SENDGRID_FROM_EMAIL: "env-from-email",
} as const;

const FORBIDDEN_HOSTS = [
  "verify.twilio.com",
  "/verifications",
  "api.bird.com",
  "amazonaws.com",
];

interface RecordedHttp {
  url: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  body: string | null;
}

class MemorySecrets extends Secrets {
  readonly reads: string[] = [];

  constructor(private readonly stored: Readonly<Record<string, string>>) {
    super();
  }

  override async read(name: string): Promise<string> {
    this.reads.push(name);
    const value = this.stored[name];

    if (value === undefined) {
      throw new Error(`Unknown secret: ${name}`);
    }

    return value;
  }
}

class RecordingSender extends OneTimeCodeSender {
  readonly messages: OneTimeCodeMessage[] = [];

  constructor(private readonly inner: OneTimeCodeSender) {
    super();
  }

  override async send(message: OneTimeCodeMessage): Promise<void> {
    await this.inner.send(message);
    this.messages.push(message);
  }
}

const configured = (): MemorySecrets =>
  new MemorySecrets({
    "twilio.account-sid": ACCOUNT_SID,
    "twilio.auth-token": AUTH_TOKEN,
    "twilio.sms-from": SMS_FROM,
    "sendgrid.api-key": API_KEY,
    "sendgrid.from-email": FROM_EMAIL,
  });

const sms = (): OneTimeCodeMessage => ({
  channel: "sms",
  destination: "+573009998877",
  code: CODE,
  companyName: COMPANY,
  expiresInMinutes: MINUTES,
});

const email = (): OneTimeCodeMessage => ({
  channel: "email",
  destination: "holder@example.com",
  code: CODE,
  companyName: COMPANY,
  expiresInMinutes: MINUTES,
});

const accepted = (status: number): Response => new Response(null, { status });

const installFetch = (...responses: Response[]): RecordedHttp[] => {
  const recorded: RecordedHttp[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const headers = new Headers(init?.headers);
    recorded.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      contentType: headers.get("content-type"),
      body: typeof init?.body === "string" ? init.body : null,
    });

    const response = responses[recorded.length - 1];

    if (response === undefined) {
      return Promise.reject(new Error("No recorded HTTP response."));
    }

    return Promise.resolve(response);
  });

  return recorded;
};

const restoreEnv = (name: string, previous: string | undefined): void => {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
};

const withDecoys = async (act: () => Promise<void>): Promise<void> => {
  const previous = new Map<string, string | undefined>();

  for (const name of Object.keys(DECOY)) {
    previous.set(name, process.env[name]);
    process.env[name] = DECOY[name as keyof typeof DECOY];
  }

  try {
    await act();
  } finally {
    for (const [name, value] of previous) {
      restoreEnv(name, value);
    }
  }
};

const silence = (): string[] => {
  const lines: string[] = [];
  const record = (...args: readonly unknown[]): void => {
    lines.push(args.map((part) => String(part)).join(" "));
  };

  vi.spyOn(console, "log").mockImplementation(record);
  vi.spyOn(console, "info").mockImplementation(record);
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  vi.spyOn(console, "debug").mockImplementation(record);

  return lines;
};

const expectCarrier = (url: string): void => {
  const lower = url.toLowerCase();

  for (const marker of FORBIDDEN_HOSTS) {
    expect(lower).not.toContain(marker);
  }
};

const expectNoEnv = (recorded: RecordedHttp): void => {
  const blob = `${recorded.url}\n${recorded.authorization ?? ""}\n${recorded.body ?? ""}`;

  expect(blob).not.toContain("env-account-sid");
  expect(blob).not.toContain("env-auth-token");
  expect(blob).not.toContain("env-sms-from");
  expect(blob).not.toContain("env-api-key");
  expect(blob).not.toContain("env-from-email");
};

const expectQuiet = (lines: string[]): void => {
  expect(lines.join("\n")).not.toContain(CODE);
};

afterEach(() => {
  vi.restoreAllMocks();
});

oneTimeCodeSenderContract(() => {
  installFetch(accepted(202));
  const recording = new RecordingSender(
    new TwilioOneTimeCodeSender(configured()),
  );

  return {
    sender: () => recording,
    delivered: () => recording.messages,
  };
});

it("given Twilio secrets, when an SMS code is sent, then Twilio Messages receives the destination, sender, and code", async () => {
  const stored = configured();
  const recorded = installFetch(accepted(201));
  const lines = silence();

  await withDecoys(async () => {
    await new TwilioOneTimeCodeSender(stored).send(sms());
  });

  const call = recorded[0];
  expect(call).toBeDefined();
  expect(call?.url).toBe(MESSAGES_URL);
  expect(call?.method).toBe("POST");
  expect(call?.contentType).toBe("application/x-www-form-urlencoded");
  expect(call?.authorization).toBe(
    `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
  );
  expectCarrier(call?.url ?? "");
  expectNoEnv(call as RecordedHttp);

  const form = new URLSearchParams(call?.body ?? "");
  expect([...form.keys()].toSorted()).toEqual(["Body", "From", "To"]);
  expect(form.get("To")).toBe("+573009998877");
  expect(form.get("From")).toBe(SMS_FROM);
  expect(form.get("Body")).toBe(TEXT);
  expect(stored.reads).toEqual([
    "twilio.account-sid",
    "twilio.auth-token",
    "twilio.sms-from",
  ]);
  expectQuiet(lines);
});

it("given SendGrid secrets, when an email code is sent, then SendGrid v3 receives the destination, sender, and code", async () => {
  const stored = configured();
  const recorded = installFetch(accepted(202));
  const lines = silence();

  await withDecoys(async () => {
    await new TwilioOneTimeCodeSender(stored).send(email());
  });

  const call = recorded[0];
  expect(call?.url).toBe(MAIL_URL);
  expect(call?.method).toBe("POST");
  expect(call?.contentType).toBe("application/json");
  expect(call?.authorization).toBe(`Bearer ${API_KEY}`);
  expectCarrier(call?.url ?? "");
  expectNoEnv(call as RecordedHttp);
  expect(JSON.parse(call?.body ?? "")).toEqual({
    personalizations: [{ to: [{ email: "holder@example.com" }] }],
    from: { email: FROM_EMAIL },
    subject: `${COMPANY} verification code`,
    content: [{ type: "text/plain", value: TEXT }],
  });
  expect(stored.reads).toEqual(["sendgrid.api-key", "sendgrid.from-email"]);
  expectQuiet(lines);
});

it("given Twilio rejects the message, when an SMS code is sent, then delivery fails without the code", async () => {
  installFetch(new Response("no", { status: 401 }));
  const lines = silence();

  await expect(
    withDecoys(async () => {
      await new TwilioOneTimeCodeSender(configured()).send(sms());
    }),
  ).rejects.toMatchObject({
    name: "OneTimeCodeDeliveryFailed",
    message: "The one-time code could not be delivered.",
  });
  expectQuiet(lines);
});

it("given SendGrid rejects the message, when an email code is sent, then delivery fails without the code", async () => {
  installFetch(new Response("no", { status: 403 }));

  await expect(
    withDecoys(async () => {
      await new TwilioOneTimeCodeSender(configured()).send(email());
    }),
  ).rejects.toBeInstanceOf(OneTimeCodeDeliveryFailed);
});

it("given a Twilio secret is missing, when an SMS code is sent, then delivery fails and nothing is fetched", async () => {
  const recorded = installFetch(accepted(201));
  const stored = new MemorySecrets({
    "twilio.auth-token": AUTH_TOKEN,
    "twilio.sms-from": SMS_FROM,
  });

  await expect(
    new TwilioOneTimeCodeSender(stored).send(sms()),
  ).rejects.toBeInstanceOf(OneTimeCodeDeliveryFailed);
  expect(recorded).toEqual([]);
});

it("given the network rejects the call, when an SMS code is sent, then delivery fails", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

  await expect(
    withDecoys(async () => {
      await new TwilioOneTimeCodeSender(configured()).send(sms());
    }),
  ).rejects.toBeInstanceOf(OneTimeCodeDeliveryFailed);
});
