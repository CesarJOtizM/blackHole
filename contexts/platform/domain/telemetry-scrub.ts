const REDACTED = "[redacted]";

const SENSITIVE_WORDS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "name",
  "phone",
  "address",
  "identification",
]);

const BEARER = /\bbearer\s+\S+/gi;
const SENSITIVE_ASSIGNMENT =
  /\b(authorization|cookie|password|token|secret|name|phone|address|identification)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi;
const PHONE =
  /(?<!\d)(?:\+?57[\s-]?)?3\d{2}(?:[\s.-]?\d{3})[\s.-]?\d{4}(?!\d)/g;
const DOTTED_ID = /(?<!\d)\d{1,3}(?:[.\s]\d{3}){2,3}(?!\d)/g;
const DIGIT_RUN = /(?<!\d)\d{7,10}(?!\d)/g;

const wordsOf = (key: string): readonly string[] =>
  key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);

const isSensitiveKey = (key: string): boolean =>
  wordsOf(key).some((word) => SENSITIVE_WORDS.has(word));

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value !== null && typeof value === "object") {
    const redacted: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = isSensitiveKey(key) ? REDACTED : redactValue(nested);
    }

    return redacted;
  }

  return value;
};

const scrubText = (text: string): string =>
  text
    .replace(BEARER, REDACTED)
    .replace(SENSITIVE_ASSIGNMENT, `$1=${REDACTED}`)
    .replace(PHONE, REDACTED)
    .replace(DOTTED_ID, REDACTED)
    .replace(DIGIT_RUN, REDACTED);

export const scrubTelemetry = (value: unknown): string => {
  if (typeof value === "string") {
    return scrubText(value);
  }

  return scrubText(JSON.stringify(redactValue(value)) ?? "");
};
