import { expect, it } from "vitest";

import {
  issueOneTimeCode as issueOneTimeCodeFromDomain,
  verifyOneTimeCode as verifyOneTimeCodeFromDomain,
} from "#domain/index.js";
import {
  ClearOneTimeCodeRejected,
  InvalidOneTimeCodeDigit,
  issueOneTimeCode,
  type OneTimeCodeRecord,
  resendOneTimeCode,
  verifyOneTimeCode,
} from "#domain/one-time-code.js";

const ISSUED_AT = "2026-11-05T16:00:00.000Z";
const EXPIRES_AT = "2026-11-05T16:10:00.000Z";
const JUST_BEFORE_RESEND = "2026-11-05T16:00:59.999Z";
const RESEND_AT = "2026-11-05T16:01:00.000Z";
const RESEND_EXPIRES_AT = "2026-11-05T16:11:00.000Z";
const JUST_BEFORE_EXPIRY = "2026-11-05T16:09:59.999Z";
const AFTER_EXPIRY = "2026-11-05T16:10:00.001Z";
const CODE = "123456";
const RESENT_CODE = "654321";
const WRONG_CODE = "000000";

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

const issuedRecord = (): OneTimeCodeRecord =>
  issueOneTimeCode({
    at: ISSUED_AT,
    digest: fingerprint,
    nextDigit: digitsOf(CODE),
  }).record;

it("given a one-time code, when it is issued, then it has six digits, expires after ten minutes, and keeps only the digest", () => {
  const issued = issueOneTimeCode({
    at: ISSUED_AT,
    digest: fingerprint,
    nextDigit: digitsOf(CODE),
  });

  expect(issued.code).toBe(CODE);
  expect(issued.code).toMatch(/^\d{6}$/);
  expect(issued.record).toEqual({
    digest: "fp:BCDEFG",
    sentAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    attemptsRemaining: 5,
    spent: false,
  });
  expect(issued.record).not.toHaveProperty("code");

  for (const value of Object.values(issued.record)) {
    expect(value).not.toBe(issued.code);

    if (typeof value === "string") {
      expect(value).not.toContain(issued.code);
    }
  }
});

it("given a digest that repeats the code, when it is issued, then the clear code is refused", () => {
  expect(() =>
    issueOneTimeCode({
      at: ISSUED_AT,
      digest: (code) => code,
      nextDigit: digitsOf(CODE),
    }),
  ).toThrow(ClearOneTimeCodeRejected);
});

it("given a digit outside 0 to 9, when a code is issued, then it is refused", () => {
  expect(() =>
    issueOneTimeCode({
      at: ISSUED_AT,
      digest: fingerprint,
      nextDigit: () => 10,
    }),
  ).toThrow(InvalidOneTimeCodeDigit);
});

it("given four wrong attempts, when the fifth code matches, then it is accepted", () => {
  let record = issuedRecord();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rejected = verifyOneTimeCode({
      record,
      code: WRONG_CODE,
      digest: fingerprint,
      at: ISSUED_AT,
    });

    expect(rejected.outcome).toBe("rejected");
    expect(rejected.record.attemptsRemaining).toBe(4 - attempt);
    expect(record.attemptsRemaining).toBe(5 - attempt);
    record = rejected.record;
  }

  const accepted = verifyOneTimeCode({
    record,
    code: CODE,
    digest: fingerprint,
    at: ISSUED_AT,
  });

  expect(accepted).toEqual({
    outcome: "accepted",
    record: {
      digest: "fp:BCDEFG",
      sentAt: ISSUED_AT,
      expiresAt: EXPIRES_AT,
      attemptsRemaining: 1,
      spent: true,
    },
  });
  expect(JSON.stringify(accepted.record)).not.toContain(CODE);
});

it("given five wrong attempts, when another code is checked, then the code stays locked", () => {
  let record = issuedRecord();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rejected = verifyOneTimeCode({
      record,
      code: WRONG_CODE,
      digest: fingerprint,
      at: ISSUED_AT,
    });
    record = rejected.record;
  }

  const locked = verifyOneTimeCode({
    record,
    code: WRONG_CODE,
    digest: fingerprint,
    at: ISSUED_AT,
  });
  const afterLock = verifyOneTimeCode({
    record: locked.record,
    code: CODE,
    digest: fingerprint,
    at: ISSUED_AT,
  });

  expect(locked).toEqual({
    outcome: "locked",
    record: {
      digest: "fp:BCDEFG",
      sentAt: ISSUED_AT,
      expiresAt: EXPIRES_AT,
      attemptsRemaining: 0,
      spent: false,
    },
  });
  expect(afterLock).toEqual(locked);
});

it("given a matching code, when it is used once, then a second use is refused", () => {
  const issued = issueOneTimeCode({
    at: ISSUED_AT,
    digest: fingerprint,
    nextDigit: digitsOf(CODE),
  });
  const accepted = verifyOneTimeCode({
    record: issued.record,
    code: CODE,
    digest: fingerprint,
    at: ISSUED_AT,
  });
  const repeated = verifyOneTimeCode({
    record: accepted.record,
    code: CODE,
    digest: fingerprint,
    at: ISSUED_AT,
  });

  expect(accepted.outcome).toBe("accepted");
  expect(accepted.record.spent).toBe(true);
  expect(repeated).toEqual({
    outcome: "spent",
    record: accepted.record,
  });
  expect(JSON.stringify(repeated.record)).not.toContain(CODE);
});

it("given a code sent under sixty seconds ago, when resend is requested, then it waits until sixty seconds", () => {
  const issued = issueOneTimeCode({
    at: ISSUED_AT,
    digest: fingerprint,
    nextDigit: digitsOf(CODE),
  });
  const early = resendOneTimeCode({
    record: issued.record,
    at: JUST_BEFORE_RESEND,
    digest: fingerprint,
    nextDigit: () => {
      throw new Error("Digit was read too soon.");
    },
  });
  const resent = resendOneTimeCode({
    record: issued.record,
    at: RESEND_AT,
    digest: fingerprint,
    nextDigit: digitsOf(RESENT_CODE),
  });
  const previous = verifyOneTimeCode({
    record: resent.outcome === "sent" ? resent.record : issued.record,
    code: CODE,
    digest: fingerprint,
    at: RESEND_AT,
  });

  expect(early).toEqual({ outcome: "too_soon", record: issued.record });
  expect(resent).toEqual({
    outcome: "sent",
    code: RESENT_CODE,
    record: {
      digest: "fp:GFEDCB",
      sentAt: RESEND_AT,
      expiresAt: RESEND_EXPIRES_AT,
      attemptsRemaining: 5,
      spent: false,
    },
  });
  expect(resent.record).not.toHaveProperty("code");
  expect(JSON.stringify(resent.record)).not.toContain(RESENT_CODE);
  expect(previous.outcome).toBe("rejected");
});

it("given an expired code, when it is checked, then it is refused", () => {
  const record = issuedRecord();
  const beforeExpiry = verifyOneTimeCode({
    record,
    code: CODE,
    digest: fingerprint,
    at: JUST_BEFORE_EXPIRY,
  });
  const atExpiry = verifyOneTimeCode({
    record,
    code: CODE,
    digest: fingerprint,
    at: EXPIRES_AT,
  });
  const afterExpiry = verifyOneTimeCode({
    record,
    code: CODE,
    digest: fingerprint,
    at: AFTER_EXPIRY,
  });

  expect(beforeExpiry.outcome).toBe("accepted");
  expect(atExpiry).toEqual({ outcome: "expired", record });
  expect(afterExpiry).toEqual({ outcome: "expired", record });
  expect(record.attemptsRemaining).toBe(5);
});

it("given the invoicing domain, when one-time code is exported, then issuing and verifying use those functions", () => {
  expect(issueOneTimeCodeFromDomain).toBe(issueOneTimeCode);
  expect(verifyOneTimeCodeFromDomain).toBe(verifyOneTimeCode);
});
