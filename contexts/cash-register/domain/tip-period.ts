const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const TIP_PERIOD_KIND = {
  SHIFT: "shift",
  DAY: "day",
  WEEK: "week",
} as const;

export type TipPeriodKind =
  (typeof TIP_PERIOD_KIND)[keyof typeof TIP_PERIOD_KIND];

export class InvalidTipInstant extends Error {
  constructor() {
    super("A tip instant must be a valid timestamp.");
    this.name = "InvalidTipInstant";
  }
}

export class InvalidTipWindow extends Error {
  constructor() {
    super("A tip window needs a start before its end.");
    this.name = "InvalidTipWindow";
  }
}

function instantMs(value: string): number {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new InvalidTipInstant();
  }

  return parsed;
}

function bogotaDate(utcMs: number): string {
  return new Date(utcMs - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function utcMidnightMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function addDays(date: string, days: number): string {
  return new Date(utcMidnightMs(date) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function bogotaDayStart(date: string): string {
  return new Date(utcMidnightMs(date) + BOGOTA_OFFSET_MS).toISOString();
}

function mondayOf(date: string): string {
  const weekday = new Date(utcMidnightMs(date)).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;

  return addDays(date, -daysFromMonday);
}

export class TipPeriod {
  readonly kind: TipPeriodKind;
  readonly from: string;
  readonly to: string;

  private constructor(kind: TipPeriodKind, from: string, to: string) {
    this.kind = kind;
    this.from = from;
    this.to = to;
  }

  static shift(input: { from: string; to: string }): TipPeriod {
    const fromMs = instantMs(input.from);
    const toMs = instantMs(input.to);

    if (fromMs >= toMs) {
      throw new InvalidTipWindow();
    }

    return new TipPeriod(TIP_PERIOD_KIND.SHIFT, input.from, input.to);
  }

  static day(input: { at: string }): TipPeriod {
    const date = bogotaDate(instantMs(input.at));

    return new TipPeriod(
      TIP_PERIOD_KIND.DAY,
      bogotaDayStart(date),
      bogotaDayStart(addDays(date, 1)),
    );
  }

  static week(input: { at: string }): TipPeriod {
    const monday = mondayOf(bogotaDate(instantMs(input.at)));

    return new TipPeriod(
      TIP_PERIOD_KIND.WEEK,
      bogotaDayStart(monday),
      bogotaDayStart(addDays(monday, 7)),
    );
  }

  contains(recordedAt: string): boolean {
    const at = instantMs(recordedAt);

    return at >= instantMs(this.from) && at < instantMs(this.to);
  }
}
