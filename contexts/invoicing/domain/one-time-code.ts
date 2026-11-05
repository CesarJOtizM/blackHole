export const ONE_TIME_CODE_LENGTH = 6;
export const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;
export const ONE_TIME_CODE_ATTEMPT_LIMIT = 5;
export const ONE_TIME_CODE_RESEND_MS = 60 * 1000;

export class ClearOneTimeCodeRejected extends Error {
  constructor() {
    super("A one-time code digest must not be the code.");
    this.name = "ClearOneTimeCodeRejected";
  }
}

export class InvalidOneTimeCodeDigit extends Error {
  constructor() {
    super("A one-time code digit must be an integer from 0 to 9.");
    this.name = "InvalidOneTimeCodeDigit";
  }
}

export class InvalidOneTimeCodeInstant extends Error {
  constructor() {
    super("The one-time code instant is unreadable.");
    this.name = "InvalidOneTimeCodeInstant";
  }
}

export interface OneTimeCodeRecord {
  digest: string;
  sentAt: string;
  expiresAt: string;
  attemptsRemaining: number;
  spent: boolean;
}

export interface IssuedOneTimeCode {
  code: string;
  record: OneTimeCodeRecord;
}

export type OneTimeCodeDigest = (code: string) => string;

export type OneTimeCodeDigit = () => number;

export type OneTimeCodeVerification =
  | { outcome: "accepted"; record: OneTimeCodeRecord }
  | { outcome: "rejected"; record: OneTimeCodeRecord }
  | { outcome: "locked"; record: OneTimeCodeRecord }
  | { outcome: "expired"; record: OneTimeCodeRecord }
  | { outcome: "spent"; record: OneTimeCodeRecord };

export type OneTimeCodeResend =
  | { outcome: "too_soon"; record: OneTimeCodeRecord }
  | { outcome: "sent"; code: string; record: OneTimeCodeRecord };

const readInstant = (value: string): number => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new InvalidOneTimeCodeInstant();
  }

  return parsed;
};

const readCode = (nextDigit: OneTimeCodeDigit): string => {
  let code = "";

  for (let index = 0; index < ONE_TIME_CODE_LENGTH; index += 1) {
    const digit = nextDigit();

    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new InvalidOneTimeCodeDigit();
    }

    code += String(digit);
  }

  return code;
};

const remember = (code: string, digest: OneTimeCodeDigest): string => {
  const fingerprint = digest(code);

  if (fingerprint.length === 0 || fingerprint === code) {
    throw new ClearOneTimeCodeRejected();
  }

  return fingerprint;
};

const closed = (expiresAt: string, at: string): boolean => {
  const expiry = Date.parse(expiresAt);
  const checkedAt = Date.parse(at);

  return (
    !Number.isFinite(expiry) ||
    !Number.isFinite(checkedAt) ||
    checkedAt >= expiry
  );
};

const recordAt = (
  code: string,
  digest: OneTimeCodeDigest,
  at: string,
): OneTimeCodeRecord => {
  const sentAt = readInstant(at);

  return {
    digest: remember(code, digest),
    sentAt: new Date(sentAt).toISOString(),
    expiresAt: new Date(sentAt + ONE_TIME_CODE_TTL_MS).toISOString(),
    attemptsRemaining: ONE_TIME_CODE_ATTEMPT_LIMIT,
    spent: false,
  };
};

export const issueOneTimeCode = (input: {
  at: string;
  digest: OneTimeCodeDigest;
  nextDigit: OneTimeCodeDigit;
}): IssuedOneTimeCode => {
  const code = readCode(input.nextDigit);

  return {
    code,
    record: recordAt(code, input.digest, input.at),
  };
};

export const verifyOneTimeCode = (input: {
  record: OneTimeCodeRecord;
  code: string;
  digest: OneTimeCodeDigest;
  at: string;
}): OneTimeCodeVerification => {
  if (closed(input.record.expiresAt, input.at)) {
    return { outcome: "expired", record: input.record };
  }

  if (input.record.spent) {
    return { outcome: "spent", record: input.record };
  }

  if (input.record.attemptsRemaining <= 0) {
    return { outcome: "locked", record: input.record };
  }

  const fingerprint = input.digest(input.code);

  if (fingerprint === input.record.digest && fingerprint !== input.code) {
    return {
      outcome: "accepted",
      record: { ...input.record, spent: true },
    };
  }

  const attemptsRemaining = input.record.attemptsRemaining - 1;
  const record = { ...input.record, attemptsRemaining };

  return {
    outcome: attemptsRemaining === 0 ? "locked" : "rejected",
    record,
  };
};

export const resendOneTimeCode = (input: {
  record: OneTimeCodeRecord;
  at: string;
  digest: OneTimeCodeDigest;
  nextDigit: OneTimeCodeDigit;
}): OneTimeCodeResend => {
  const sentAt = Date.parse(input.record.sentAt);
  const requestedAt = Date.parse(input.at);

  if (
    !Number.isFinite(sentAt) ||
    !Number.isFinite(requestedAt) ||
    requestedAt < sentAt + ONE_TIME_CODE_RESEND_MS
  ) {
    return { outcome: "too_soon", record: input.record };
  }

  const code = readCode(input.nextDigit);

  return {
    outcome: "sent",
    code,
    record: recordAt(code, input.digest, input.at),
  };
};
