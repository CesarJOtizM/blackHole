import { expect, it } from "vitest";
import {
  EvaluateCoverage,
  type EvaluateCoverageInput,
} from "#application/evaluate-coverage/evaluate-coverage.js";
import {
  ConsumptionHistory,
  type ConsumptionHour,
  type ConsumptionQuery,
} from "#application/ports/consumption-history.js";
import {
  type CoverageAlert,
  type CoverageSettings,
  LEVEL_ALERT_STATUS,
  ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { SHORTAGE_KIND } from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const BEEF_ID = "ingredient_beef";
const FRIDAY_AT = "2026-11-13T18:00:00.000Z";
const SYSTEM_ACTOR = "system.inventory";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const command = (onHandAt = FRIDAY_AT): EvaluateCoverageInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: BEEF_ID,
  occurredAt: onHandAt,
});

const completeSettings = (
  patch: Partial<CoverageSettings> = {},
): CoverageSettings => ({
  tenantId: TENANT_ID,
  venueId: SITE_A,
  weeks: 4,
  marginHours: 1,
  slotMinutes: 60,
  serviceStartMinute: 12 * 60,
  serviceEndMinute: 23 * 60,
  ...patch,
});

const FRIDAY_WEEKS = [
  "2026-10-16",
  "2026-10-23",
  "2026-10-30",
  "2026-11-06",
] as const;

const fridayHours = (weeks: number): ConsumptionHour[] =>
  FRIDAY_WEEKS.slice(0, weeks).map((weekStart) => ({
    weekStart,
    quantity: kilograms(1),
  }));

class ScriptedBalance implements ShortageTransaction {
  readonly calls: Array<{
    tenantId: string;
    locationId: string;
    ingredientId: string;
  }> = [];

  constructor(private readonly onHand: number) {}

  async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    this.calls.push({ tenantId, locationId, ingredientId });
    return this.onHand;
  }
}

class MemoryHistory extends ConsumptionHistory {
  readonly queries: ConsumptionQuery[] = [];

  constructor(private readonly rows: readonly ConsumptionHour[]) {
    super();
  }

  async hours(query: ConsumptionQuery): Promise<readonly ConsumptionHour[]> {
    this.queries.push(query);
    return this.rows;
  }
}

class MemoryAudit {
  readonly commands: Array<{
    tenantId: string;
    actorId: string;
    authorizerId: string | null;
    deviceId: string;
    siteId: string;
    action: string;
    entity: string;
    before: unknown;
    after: unknown;
    reason: string;
  }> = [];

  async record(entry: MemoryAudit["commands"][number]): Promise<void> {
    this.commands.push(entry);
  }
}

class MemoryShortageRepository extends ShortageRepository {
  readonly settingReads: ShortageTransaction[] = [];
  readonly alertWrites: ShortageTransaction[] = [];
  private readonly flags = new Set<string>();
  private settings: CoverageSettings | null = null;
  private readonly committed = new Map<string, CoverageAlert>();
  private readonly staged = new Map<
    ShortageTransaction,
    Map<string, CoverageAlert>
  >();

  async saveBrandLevel(): Promise<void> {
    return undefined;
  }

  async saveSiteLevel(): Promise<void> {
    return undefined;
  }

  async findBrandLevel(): Promise<null> {
    return null;
  }

  async findSiteLevel(): Promise<null> {
    return null;
  }

  enableAlerts(tenantId: string, venueId: string): void {
    this.flags.add(`${tenantId}:${venueId}`);
  }

  putSettings(settings: CoverageSettings): void {
    this.settings = settings;
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.flags.has(`${tenantId}:${venueId}`);
  }

  override async findCoverageSettings(
    tenantId: string,
    venueId: string,
    tx?: ShortageTransaction,
  ): Promise<CoverageSettings | null> {
    if (tx) {
      this.settingReads.push(tx);
    }

    if (
      !this.settings ||
      this.settings.tenantId !== tenantId ||
      this.settings.venueId !== venueId
    ) {
      return null;
    }

    return { ...this.settings };
  }

  override async findOpenCoverageAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<CoverageAlert | null> {
    const rows = tx ? this.draft(tx).values() : this.committed.values();

    for (const alert of rows) {
      if (
        alert.tenantId === tenantId &&
        alert.locationId === locationId &&
        alert.ingredientId === ingredientId &&
        alert.status !== LEVEL_ALERT_STATUS.RESOLVED
      ) {
        return { ...alert };
      }
    }

    return null;
  }

  override async saveCoverageAlert(
    alert: CoverageAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!tx) {
      throw new Error(
        "A coverage alert write requires the caller's transaction.",
      );
    }

    this.alertWrites.push(tx);
    this.draft(tx).set(alert.id, { ...alert });
  }

  commit(tx: ShortageTransaction): void {
    const draft = this.staged.get(tx);

    if (!draft) {
      return;
    }

    this.committed.clear();
    for (const [id, alert] of draft) {
      this.committed.set(id, { ...alert });
    }

    this.staged.delete(tx);
  }

  committedAlerts(): CoverageAlert[] {
    return [...this.committed.values()];
  }

  private draft(tx: ShortageTransaction): Map<string, CoverageAlert> {
    const existing = this.staged.get(tx);

    if (existing) {
      return existing;
    }

    const copy = new Map<string, CoverageAlert>();

    for (const [id, alert] of this.committed) {
      copy.set(id, { ...alert });
    }

    this.staged.set(tx, copy);
    return copy;
  }
}

const harness = (
  onHand: number,
  weeks: number,
  settings: CoverageSettings | null = completeSettings(),
) => {
  const shortages = new MemoryShortageRepository();
  const history = new MemoryHistory(fridayHours(weeks));
  const audits = new MemoryAudit();
  const evaluate = new EvaluateCoverage(shortages, history, audits);
  const tx = new ScriptedBalance(onHand);

  if (settings) {
    shortages.putSettings(settings);
  }

  shortages.enableAlerts(TENANT_ID, SITE_A);
  return { shortages, history, audits, evaluate, tx };
};

it("given Friday pace covers 3 of the 5 remaining service hours and stock is above the minimum, when coverage runs, then a coverage alert states the hours left", async () => {
  const { shortages, history, audits, evaluate, tx } = harness(kilograms(3), 4);

  const result = await evaluate.evaluate(tx, command());

  shortages.commit(tx);
  const [stored] = shortages.committedAlerts();
  expect(result).toEqual({ written: true, alert: stored });
  expect(stored).toMatchObject({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: SITE_A,
    locationId: LOCATION_A,
    ingredientId: BEEF_ID,
    kind: SHORTAGE_KIND.COVERAGE,
    hoursLeft: 3,
    remainingServiceHours: 5,
    status: LEVEL_ALERT_STATUS.OPEN,
    escalationClock: null,
  });
  expect(stored).not.toHaveProperty("severity");
  expect(kilograms(3)).toBeGreaterThan(kilograms(1));
  expect(history.queries).toEqual([
    {
      tenantId: TENANT_ID,
      locationId: LOCATION_A,
      ingredientId: BEEF_ID,
      weekday: 5,
      slotStartMinute: 18 * 60,
    },
  ]);
  expect(tx.calls).toEqual([
    {
      tenantId: TENANT_ID,
      locationId: LOCATION_A,
      ingredientId: BEEF_ID,
    },
  ]);
  expect(shortages.settingReads).toEqual([tx]);
  expect(shortages.alertWrites).toEqual([tx]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.open-coverage-alert",
      entity: stored?.id,
      before: null,
      after: stored,
      reason: "inventory.open-coverage-alert",
    },
  ]);
  expect(JSON.stringify(stored)).not.toMatch(/whatsapp|sms|email|web push/i);
});

it("given Friday pace covers the remaining service plus the margin, when coverage runs, then no coverage alert opens", async () => {
  const { shortages, evaluate, tx } = harness(kilograms(6), 4);

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(shortages.committedAlerts()).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
});

it("given an open coverage alert, when Friday coverage runs again, then it is not repeated", async () => {
  const { shortages, audits, evaluate, tx } = harness(kilograms(3), 4);
  await evaluate.evaluate(tx, command());
  shortages.commit(tx);
  const again = new ScriptedBalance(kilograms(3));

  const result = await evaluate.evaluate(again, command());

  shortages.commit(again);
  expect(result).toEqual({ written: false });
  expect(shortages.committedAlerts()).toHaveLength(1);
  expect(audits.commands).toHaveLength(1);
});

it("given fewer than N Friday weeks, when coverage runs, then no coverage alert opens", async () => {
  const { shortages, history, evaluate, tx } = harness(kilograms(3), 3);

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(history.queries).toHaveLength(1);
  expect(tx.calls).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
});

it("given N, the margin, the slot, or the service window is missing, when coverage runs, then no coverage alert opens and no number is assumed", async () => {
  const missing: Array<Partial<CoverageSettings>> = [
    { weeks: null },
    { marginHours: null },
    { slotMinutes: null },
    { serviceStartMinute: null },
    { serviceEndMinute: null },
  ];

  for (const patch of missing) {
    const { shortages, history, evaluate, tx } = harness(
      kilograms(3),
      4,
      completeSettings(patch),
    );

    const result = await evaluate.evaluate(tx, command());

    expect(result).toEqual({ written: false });
    expect(history.queries).toEqual([]);
    expect(tx.calls).toEqual([]);
    expect(shortages.alertWrites).toEqual([]);
    expect(shortages.committedAlerts()).toEqual([]);
  }
});

it("given shortage alerts are off for the venue, when Friday coverage would be short, then nothing is written", async () => {
  const shortages = new MemoryShortageRepository();
  const history = new MemoryHistory(fridayHours(4));
  const evaluate = new EvaluateCoverage(shortages, history, new MemoryAudit());
  const tx = new ScriptedBalance(kilograms(3));
  shortages.putSettings(completeSettings());

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(shortages.settingReads).toEqual([]);
  expect(history.queries).toEqual([]);
  expect(tx.calls).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
});
