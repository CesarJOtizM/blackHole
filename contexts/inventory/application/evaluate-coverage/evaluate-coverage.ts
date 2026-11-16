import type { ConsumptionHistory } from "#application/ports/consumption-history.js";
import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  type CoverageAlert,
  type CoverageSettings,
  LEVEL_ALERT_STATUS,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import { SHORTAGE_KIND } from "#domain/shortage-alert.js";

const SYSTEM_ACTOR = "system.inventory";
const OPEN_ACTION = "inventory.open-coverage-alert";
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export interface EvaluateCoverageInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  occurredAt: string;
}

export type CoverageEvaluation =
  | { readonly written: false }
  | { readonly written: true; readonly alert: CoverageAlert };

interface CompleteCoverage {
  weeks: number;
  marginHours: number;
  slotMinutes: number;
  serviceStartMinute: number;
  serviceEndMinute: number;
}

const whole = (value: number): boolean => Number.isInteger(value);

const completeSettings = (
  settings: CoverageSettings | null,
): CompleteCoverage | null => {
  if (!settings) {
    return null;
  }

  const {
    weeks,
    marginHours,
    slotMinutes,
    serviceStartMinute,
    serviceEndMinute,
  } = settings;

  if (
    weeks === null ||
    marginHours === null ||
    slotMinutes === null ||
    serviceStartMinute === null ||
    serviceEndMinute === null ||
    !whole(weeks) ||
    weeks < 1 ||
    !Number.isFinite(marginHours) ||
    marginHours < 0 ||
    !whole(slotMinutes) ||
    slotMinutes < 1 ||
    !whole(serviceStartMinute) ||
    !whole(serviceEndMinute) ||
    serviceStartMinute < 0 ||
    serviceEndMinute > MINUTES_PER_DAY ||
    serviceEndMinute <= serviceStartMinute
  ) {
    return null;
  }

  return {
    weeks,
    marginHours,
    slotMinutes,
    serviceStartMinute,
    serviceEndMinute,
  };
};

const minuteOfDay = (occurredAt: string): number | null => {
  const parsed = Date.parse(occurredAt);

  if (Number.isNaN(parsed)) {
    return null;
  }

  const date = new Date(parsed);
  return date.getUTCHours() * MINUTES_PER_HOUR + date.getUTCMinutes();
};

const weekdayOf = (occurredAt: string): number | null => {
  const parsed = Date.parse(occurredAt);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).getUTCDay();
};

const hourlyUse = (
  rows: readonly { weekStart: string; quantity: number }[],
  weeks: number,
): number | null => {
  const quantities = new Map<string, number[]>();

  for (const row of rows) {
    const found = quantities.get(row.weekStart) ?? [];
    found.push(row.quantity);
    quantities.set(row.weekStart, found);
  }

  if (quantities.size < weeks) {
    return null;
  }

  const chosen = [...quantities.keys()].sort().slice(-weeks);
  let total = 0;
  let count = 0;

  for (const week of chosen) {
    for (const quantity of quantities.get(week) ?? []) {
      total += quantity;
      count += 1;
    }
  }

  if (count === 0 || total <= 0) {
    return null;
  }

  return total / count;
};

export class EvaluateCoverage {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly history: ConsumptionHistory,
    private readonly audits: ShortageAudit,
  ) {}

  async evaluate(
    tx: ShortageTransaction,
    input: EvaluateCoverageInput,
  ): Promise<CoverageEvaluation> {
    const enabled = await this.shortages.alertsEnabled(
      input.tenantId,
      input.venueId,
      tx,
    );

    if (!enabled) {
      return { written: false };
    }

    const settings = completeSettings(
      await this.shortages.findCoverageSettings(
        input.tenantId,
        input.venueId,
        tx,
      ),
    );
    const minute = minuteOfDay(input.occurredAt);
    const weekday = weekdayOf(input.occurredAt);

    if (!settings || minute === null || weekday === null) {
      return { written: false };
    }

    if (
      minute < settings.serviceStartMinute ||
      minute >= settings.serviceEndMinute
    ) {
      return { written: false };
    }

    const slotStartMinute =
      Math.floor(minute / settings.slotMinutes) * settings.slotMinutes;
    const samples = await this.history.hours({
      tenantId: input.tenantId,
      locationId: input.locationId,
      ingredientId: input.ingredientId,
      weekday,
      slotStartMinute,
    });
    const pace = hourlyUse(samples, settings.weeks);

    if (pace === null) {
      return { written: false };
    }

    const onHand = await tx.balance(
      input.tenantId,
      input.locationId,
      input.ingredientId,
    );
    const hoursLeft = onHand / pace;
    const remainingServiceHours =
      (settings.serviceEndMinute - minute) / MINUTES_PER_HOUR;

    if (
      !Number.isFinite(hoursLeft) ||
      hoursLeft >= remainingServiceHours + settings.marginHours
    ) {
      return { written: false };
    }

    const open = await this.shortages.findOpenCoverageAlert(
      input.tenantId,
      input.locationId,
      input.ingredientId,
      tx,
    );

    if (open) {
      return { written: false };
    }

    const alert: CoverageAlert = {
      id: `coverage:${input.tenantId}:${input.locationId}:${input.ingredientId}`,
      tenantId: input.tenantId,
      brandId: input.brandId,
      venueId: input.venueId,
      locationId: input.locationId,
      ingredientId: input.ingredientId,
      kind: SHORTAGE_KIND.COVERAGE,
      hoursLeft,
      remainingServiceHours,
      status: LEVEL_ALERT_STATUS.OPEN,
      escalationClock: null,
    };
    await this.shortages.saveCoverageAlert(alert, tx);
    await this.audits.record({
      tenantId: input.tenantId,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: OPEN_ACTION,
      entity: alert.id,
      before: null,
      after: alert,
      reason: OPEN_ACTION,
    });

    return { written: true, alert };
  }
}
