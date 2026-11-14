import { expect, it } from "vitest";
import {
  EvaluateStockLevels,
  type EvaluateStockLevelsInput,
} from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import type {
  BrandStockLevel,
  LevelAlert,
  LocationStockLevel,
  ShortageTransaction,
  SiteStockLevel,
} from "#application/ports/shortage-repository.js";
import { ShortageRepository } from "#application/ports/shortage-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  ESCALATION_CLOCK,
  LEVEL_SEVERITY,
  SHORTAGE_KIND,
  type StockLevels,
} from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const SITE_B = "organization_venue_b";
const LOCATION_A = "inventory_location_a";
const LOCATION_B = "inventory_location_b";
const LOCATION_C = "inventory_location_c";
const BEEF_ID = "ingredient_beef";
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";
const SYSTEM_ACTOR = "system.inventory";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const stockLevels = (
  reorderPoint: number,
  minimum = kilograms(8),
): StockLevels => ({
  maximum: kilograms(20),
  reorderPoint,
  minimum,
});

const command = (
  locationId: string,
  venueId: string,
): EvaluateStockLevelsInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId,
  locationId,
  ingredientId: BEEF_ID,
  occurredAt: OCCURRED_AT,
});

const brandBeef = (reorderPoint: number): BrandStockLevel => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  ...stockLevels(reorderPoint),
});

const siteBeef = (venueId: string, reorderPoint: number): SiteStockLevel => ({
  tenantId: TENANT_ID,
  venueId,
  ingredientId: BEEF_ID,
  ...stockLevels(reorderPoint),
});

const locationBeef = (
  locationId: string,
  reorderPoint: number,
): LocationStockLevel => ({
  tenantId: TENANT_ID,
  locationId,
  ingredientId: BEEF_ID,
  ...stockLevels(reorderPoint),
});

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

  async record(command: MemoryAudit["commands"][number]): Promise<void> {
    this.commands.push(command);
  }
}

class MemoryShortageRepository extends ShortageRepository {
  readonly levelReads: ShortageTransaction[] = [];
  readonly flagReads: ShortageTransaction[] = [];
  readonly alertWrites: ShortageTransaction[] = [];
  readonly negativeStockOpened: unknown[] = [];
  private readonly brands = new Map<string, BrandStockLevel>();
  private readonly sites = new Map<string, SiteStockLevel>();
  private readonly locations = new Map<string, LocationStockLevel>();
  private readonly flags = new Set<string>();
  private readonly committed = new Map<string, LevelAlert>();
  private readonly staged = new Map<
    ShortageTransaction,
    Map<string, LevelAlert>
  >();

  async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(this.brandKey(level), { ...level });
  }

  async saveSiteLevel(level: SiteStockLevel): Promise<void> {
    this.sites.set(this.siteKey(level), { ...level });
  }

  async saveLocationLevel(level: LocationStockLevel): Promise<void> {
    this.locations.set(this.locationKey(level), { ...level });
  }

  enableAlerts(tenantId: string, venueId: string): void {
    this.flags.add(`${tenantId}:${venueId}`);
  }

  async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<BrandStockLevel | null> {
    if (tx) {
      this.levelReads.push(tx);
    }

    return (
      this.brands.get(this.brandKey({ tenantId, brandId, ingredientId })) ??
      null
    );
  }

  async findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<SiteStockLevel | null> {
    if (tx) {
      this.levelReads.push(tx);
    }

    return (
      this.sites.get(this.siteKey({ tenantId, venueId, ingredientId })) ?? null
    );
  }

  override async findLocationLevel(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<LocationStockLevel | null> {
    if (tx) {
      this.levelReads.push(tx);
    }

    return (
      this.locations.get(
        this.locationKey({ tenantId, locationId, ingredientId }),
      ) ?? null
    );
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
    tx?: ShortageTransaction,
  ): Promise<boolean> {
    if (tx) {
      this.flagReads.push(tx);
    }

    return this.flags.has(`${tenantId}:${venueId}`);
  }

  override async findOpenLevelAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<LevelAlert | null> {
    return this.findActive(tenantId, locationId, ingredientId, tx);
  }

  override async saveLevelAlert(
    alert: LevelAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!tx) {
      throw new Error("A level alert write requires the caller's transaction.");
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

  rollback(tx: ShortageTransaction): void {
    this.staged.delete(tx);
  }

  pending(tx: ShortageTransaction): LevelAlert[] {
    return [...(this.staged.get(tx)?.values() ?? [])];
  }

  committedAlerts(): LevelAlert[] {
    return [...this.committed.values()];
  }

  private findActive(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): LevelAlert | null {
    const rows = tx ? this.draft(tx).values() : this.committed.values();

    for (const alert of rows) {
      if (
        alert.tenantId === tenantId &&
        alert.locationId === locationId &&
        alert.ingredientId === ingredientId &&
        alert.status !== "resolved"
      ) {
        return { ...alert };
      }
    }

    return null;
  }

  private draft(tx: ShortageTransaction): Map<string, LevelAlert> {
    const existing = this.staged.get(tx);

    if (existing) {
      return existing;
    }

    const copy = new Map<string, LevelAlert>();

    for (const [id, alert] of this.committed) {
      copy.set(id, { ...alert });
    }

    this.staged.set(tx, copy);
    return copy;
  }

  private brandKey(level: {
    tenantId: string;
    brandId: string;
    ingredientId: string;
  }): string {
    return `${level.tenantId}:${level.brandId}:${level.ingredientId}`;
  }

  private siteKey(level: {
    tenantId: string;
    venueId: string;
    ingredientId: string;
  }): string {
    return `${level.tenantId}:${level.venueId}:${level.ingredientId}`;
  }

  private locationKey(level: {
    tenantId: string;
    locationId: string;
    ingredientId: string;
  }): string {
    return `${level.tenantId}:${level.locationId}:${level.ingredientId}`;
  }
}

const harness = (onHand: number) => {
  const shortages = new MemoryShortageRepository();
  const audits = new MemoryAudit();
  const evaluate = new EvaluateStockLevels(shortages, audits);
  const tx = new ScriptedBalance(onHand);

  return { shortages, audits, evaluate, tx };
};

it("given beef at 16 kg with a reorder point of 15 kg, when evaluation reads 14 kg in that transaction, then one yellow alert opens", async () => {
  const { shortages, audits, evaluate, tx } = harness(kilograms(14));
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);

  const result = await evaluate.evaluate(tx, command(LOCATION_A, SITE_A));

  shortages.commit(tx);
  const [stored] = shortages.committedAlerts();
  expect(result).toEqual({ written: true, action: "open", alert: stored });
  expect(stored).toMatchObject({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: SITE_A,
    locationId: LOCATION_A,
    ingredientId: BEEF_ID,
    kind: SHORTAGE_KIND.LEVEL,
    severity: LEVEL_SEVERITY.YELLOW,
    soldOut: false,
    status: "open",
    escalationClock: null,
    seenBy: null,
    seenAt: null,
    resolvedBy: null,
    resolvedAt: null,
    reason: null,
  });
  expect(shortages.committedAlerts()).toHaveLength(1);
  expect(shortages.levelReads.every((read) => read === tx)).toBe(true);
  expect(shortages.levelReads.length).toBeGreaterThan(0);
  expect(shortages.alertWrites).toEqual([tx]);
  expect(shortages.flagReads).toEqual([tx]);
  expect(tx.calls).toEqual([
    {
      tenantId: TENANT_ID,
      locationId: LOCATION_A,
      ingredientId: BEEF_ID,
    },
  ]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.open-shortage-alert",
      entity: stored?.id,
      before: null,
      after: stored,
      reason: "inventory.open-shortage-alert",
    },
  ]);
  expect(JSON.stringify(result)).not.toContain("NegativeStockOpened");
  expect(stored).not.toHaveProperty("supplierId");
  expect(stored).not.toHaveProperty("channel");
  expect(stored).not.toHaveProperty("movementId");
});

it("given a yellow balance inside a transaction, when that transaction rolls back, then the alert is not stored", async () => {
  const { shortages, evaluate, tx } = harness(kilograms(14));
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);

  await evaluate.evaluate(tx, command(LOCATION_A, SITE_A));

  expect(shortages.pending(tx)).toHaveLength(1);
  expect(shortages.alertWrites).toEqual([tx]);
  shortages.rollback(tx);
  expect(shortages.pending(tx)).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
});

it("given beef at 3 kg, when evaluation reads a 4 kg waste at or under zero, then one critical alert opens", async () => {
  const { shortages, audits, evaluate, tx } = harness(
    kilograms(3) - kilograms(4),
  );
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);

  const result = await evaluate.evaluate(tx, command(LOCATION_A, SITE_A));

  shortages.commit(tx);
  const stored = shortages.committedAlerts();
  expect(stored).toHaveLength(1);
  expect(result).toEqual({ written: true, action: "open", alert: stored[0] });
  expect(stored[0]).toMatchObject({
    kind: SHORTAGE_KIND.LEVEL,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
    escalationClock: ESCALATION_CLOCK.RED,
    status: "open",
  });
  expect(stored[0]).not.toHaveProperty("criticalClock");
  expect(Object.values(ESCALATION_CLOCK)).toEqual([ESCALATION_CLOCK.RED]);
  expect(shortages.alertWrites).toEqual([tx]);
  expect(shortages.negativeStockOpened).toEqual([]);
  expect(JSON.stringify({ result, audits: audits.commands })).not.toContain(
    "NegativeStockOpened",
  );
  expect(JSON.stringify(stored[0])).not.toMatch(/whatsapp|sms|email|supplier/i);
});

it("given an open red alert, when stock rises just above the minimum, then the same state is not emitted again", async () => {
  const shortages = new MemoryShortageRepository();
  const audits = new MemoryAudit();
  const evaluate = new EvaluateStockLevels(shortages, audits);
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);
  const opened = new ScriptedBalance(kilograms(8));
  await evaluate.evaluate(opened, command(LOCATION_A, SITE_A));
  shortages.commit(opened);
  const again = new ScriptedBalance(kilograms(8) + 1);
  const writesBefore = shortages.alertWrites.length;

  const result = await evaluate.evaluate(again, command(LOCATION_A, SITE_A));

  shortages.commit(again);
  expect(result).toEqual({ written: false });
  expect(shortages.alertWrites).toHaveLength(writesBefore);
  expect(audits.commands).toHaveLength(1);
  expect(shortages.committedAlerts()).toHaveLength(1);
  expect(shortages.committedAlerts()[0]).toMatchObject({
    severity: LEVEL_SEVERITY.RED,
    status: "open",
    escalationClock: ESCALATION_CLOCK.RED,
  });
});

it("given an open yellow alert, when stock falls to zero, then that same alert is raised to one critical", async () => {
  const shortages = new MemoryShortageRepository();
  const evaluate = new EvaluateStockLevels(shortages, new MemoryAudit());
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);
  const yellow = new ScriptedBalance(kilograms(14));
  await evaluate.evaluate(yellow, command(LOCATION_A, SITE_A));
  shortages.commit(yellow);
  const opened = shortages.committedAlerts()[0];
  const critical = new ScriptedBalance(0);

  const result = await evaluate.evaluate(critical, command(LOCATION_A, SITE_A));

  shortages.commit(critical);
  const stored = shortages.committedAlerts();
  expect(stored).toHaveLength(1);
  expect(result).toEqual({ written: true, action: "raise", alert: stored[0] });
  expect(stored[0]).toMatchObject({
    id: opened?.id,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
    escalationClock: ESCALATION_CLOCK.RED,
    status: "open",
  });
  expect(shortages.negativeStockOpened).toEqual([]);
});

it("given an open red alert, when the balance rises above the reorder point, then it resolves in that transaction", async () => {
  const shortages = new MemoryShortageRepository();
  const audits = new MemoryAudit();
  const evaluate = new EvaluateStockLevels(shortages, audits);
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));
  shortages.enableAlerts(TENANT_ID, SITE_A);
  const opened = new ScriptedBalance(kilograms(8));
  await evaluate.evaluate(opened, command(LOCATION_A, SITE_A));
  shortages.commit(opened);
  const resolvedTx = new ScriptedBalance(kilograms(16));

  const result = await evaluate.evaluate(
    resolvedTx,
    command(LOCATION_A, SITE_A),
  );

  shortages.commit(resolvedTx);
  const [stored] = shortages.committedAlerts();
  expect(result).toEqual({ written: true, action: "resolve", alert: stored });
  expect(stored).toMatchObject({
    status: "resolved",
    reason: "stock above reorder point",
    resolvedBy: SYSTEM_ACTOR,
    resolvedAt: OCCURRED_AT,
  });
  expect(shortages.alertWrites.at(-1)).toBe(resolvedTx);
  expect(audits.commands.at(-1)).toMatchObject({
    action: "inventory.resolve-shortage-alert",
    reason: "stock above reorder point",
    after: stored,
  });
});

it("given shortage alerts are off for the venue, when the balance is at or under the reorder point, then nothing is written", async () => {
  const { shortages, audits, evaluate, tx } = harness(kilograms(14));
  await shortages.saveBrandLevel(brandBeef(kilograms(15)));

  const result = await evaluate.evaluate(tx, command(LOCATION_A, SITE_A));

  expect(result).toEqual({ written: false });
  expect(shortages.flagReads).toEqual([tx]);
  expect(shortages.levelReads).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
  expect(shortages.pending(tx)).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
  expect(shortages.negativeStockOpened).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(tx.calls).toEqual([]);
});

it("given a location reorder point of 12 kg and a venue reorder point of 15 kg, when the balance is 13 kg, then the location level wins and a venue override still applies", async () => {
  const location = harness(kilograms(13));
  await location.shortages.saveBrandLevel(brandBeef(kilograms(10)));
  await location.shortages.saveSiteLevel(siteBeef(SITE_A, kilograms(15)));
  await location.shortages.saveLocationLevel(
    locationBeef(LOCATION_A, kilograms(12)),
  );
  location.shortages.enableAlerts(TENANT_ID, SITE_A);
  location.shortages.enableAlerts(TENANT_ID, SITE_B);

  const atLocation = await location.evaluate.evaluate(
    location.tx,
    command(LOCATION_A, SITE_A),
  );

  expect(atLocation).toEqual({ written: false });
  expect(location.shortages.committedAlerts()).toEqual([]);
  expect(location.shortages.alertWrites).toEqual([]);

  const venueOnly = new MemoryShortageRepository();
  await venueOnly.saveBrandLevel(brandBeef(kilograms(10)));
  await venueOnly.saveSiteLevel(siteBeef(SITE_A, kilograms(15)));
  venueOnly.enableAlerts(TENANT_ID, SITE_A);
  const venueTx = new ScriptedBalance(kilograms(12));
  const venueEval = new EvaluateStockLevels(venueOnly, new MemoryAudit());

  const atVenue = await venueEval.evaluate(
    venueTx,
    command(LOCATION_B, SITE_A),
  );

  venueOnly.commit(venueTx);
  expect(atVenue).toMatchObject({ written: true, action: "open" });
  expect(venueOnly.committedAlerts()[0]).toMatchObject({
    locationId: LOCATION_B,
    venueId: SITE_A,
    severity: LEVEL_SEVERITY.YELLOW,
  });

  const brandOnly = new MemoryShortageRepository();
  await brandOnly.saveBrandLevel(brandBeef(kilograms(10)));
  brandOnly.enableAlerts(TENANT_ID, SITE_B);
  const brandTx = new ScriptedBalance(kilograms(12));
  const brandEval = new EvaluateStockLevels(brandOnly, new MemoryAudit());

  const atBrand = await brandEval.evaluate(
    brandTx,
    command(LOCATION_C, SITE_B),
  );

  expect(atBrand).toEqual({ written: false });
  expect(brandOnly.committedAlerts()).toEqual([]);
});
