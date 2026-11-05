const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const REINVOICE_WINDOW_MODE = {
  SAME_DAY: "same_day",
  SAME_MONTH: "same_month",
  OFF: "off",
} as const;

export type ReinvoiceWindowMode =
  (typeof REINVOICE_WINDOW_MODE)[keyof typeof REINVOICE_WINDOW_MODE];

export const DEFAULT_REINVOICE_WINDOW_MODE = REINVOICE_WINDOW_MODE.SAME_DAY;

interface BogotaInstant {
  dayKey: string;
  monthKey: string;
  epochMs: number;
}

const bogotaInstant = (value: string): BogotaInstant | undefined => {
  const epochMs = Date.parse(value);

  if (!Number.isFinite(epochMs)) {
    return undefined;
  }

  const bogota = new Date(epochMs - BOGOTA_OFFSET_MS);
  const year = bogota.getUTCFullYear();
  const month = String(bogota.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bogota.getUTCDate()).padStart(2, "0");

  return {
    dayKey: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
    epochMs,
  };
};

const calendarOpen = (
  mode: ReinvoiceWindowMode,
  issued: BogotaInstant,
  at: BogotaInstant,
): boolean => {
  if (mode === REINVOICE_WINDOW_MODE.SAME_MONTH) {
    return issued.monthKey === at.monthKey;
  }

  if (mode === REINVOICE_WINDOW_MODE.SAME_DAY) {
    return issued.dayKey === at.dayKey;
  }

  return false;
};

export const isReinvoiceWindowOpen = (input: {
  issuedAt: string;
  at: string;
  mode?: ReinvoiceWindowMode;
}): boolean => {
  const mode = input.mode ?? DEFAULT_REINVOICE_WINDOW_MODE;

  if (mode === REINVOICE_WINDOW_MODE.OFF) {
    return false;
  }

  const issued = bogotaInstant(input.issuedAt);
  const at = bogotaInstant(input.at);

  if (issued === undefined || at === undefined || at.epochMs < issued.epochMs) {
    return false;
  }

  return calendarOpen(mode, issued, at);
};
