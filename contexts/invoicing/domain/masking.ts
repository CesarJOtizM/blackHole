const MASKED_TAIL = "***";

const firstAndTail = (value: string): string =>
  `${value.charAt(0)}${MASKED_TAIL}`;

export const maskName = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map(firstAndTail)
    .join(" ");

export const maskEmail = (email: string): string => {
  const separator = email.indexOf("@");
  const local = separator < 0 ? email : email.slice(0, separator);
  const domain = separator < 0 ? "" : email.slice(separator);

  return `${firstAndTail(local)}${domain}`;
};
