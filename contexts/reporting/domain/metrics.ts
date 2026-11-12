export interface SalesParts {
  grossCop: number;
  discountCop: number;
  includedTaxCop: number;
  tipCop: number;
}

export const durationMs = (
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): number | null => {
  if (startedAt == null || endedAt == null) {
    return null;
  }

  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);

  if (Number.isNaN(started) || Number.isNaN(ended)) {
    return null;
  }

  return ended - started;
};

export const nearestRank = (
  samples: readonly number[],
  percentile: number,
): number | null => {
  if (samples.length === 0) {
    return null;
  }

  const sorted = samples.toSorted((left, right) => left - right);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.min(sorted.length - 1, Math.max(0, index))] ?? null;
};

export const average = (samples: readonly number[]): number | null => {
  if (samples.length === 0) {
    return null;
  }

  return samples.reduce((total, value) => total + value, 0) / samples.length;
};

export const netSalesCop = (parts: SalesParts): number =>
  parts.grossCop - parts.discountCop - parts.includedTaxCop - parts.tipCop;

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const WEEKDAY = {
  SUNDAY: "sunday",
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
} as const;

export type Weekday = (typeof WEEKDAY)[keyof typeof WEEKDAY];

const WEEKDAYS = [
  WEEKDAY.SUNDAY,
  WEEKDAY.MONDAY,
  WEEKDAY.TUESDAY,
  WEEKDAY.WEDNESDAY,
  WEEKDAY.THURSDAY,
  WEEKDAY.FRIDAY,
  WEEKDAY.SATURDAY,
] as const;

const bogotaInstant = (instant: string): Date =>
  new Date(Date.parse(instant) - BOGOTA_OFFSET_MS);

export const bogotaHour = (instant: string): number =>
  bogotaInstant(instant).getUTCHours();

export const bogotaWeekday = (instant: string): Weekday =>
  WEEKDAYS[bogotaInstant(instant).getUTCDay()] ?? WEEKDAY.SUNDAY;
