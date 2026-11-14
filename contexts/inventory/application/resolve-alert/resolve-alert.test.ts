import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { PlatformShortageAudit } from "#application/ports/shortage-audit.js";
import {
  type BrandStockLevel,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type LocationStockLevel,
  ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import {
  ResolveAlert,
  ResolveReasonRequired,
} from "#application/resolve-alert/resolve-alert.js";
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
const LOCATION_A = "inventory_location_a";
const BEEF_ID = "ingredient_beef";
const ALERT_ID =
  "level:organization_tenant_1:inventory_location_a:ingredient_beef";
const ACTOR_ID = "user_site_admin";
const RESOLVED_AT = "2026-11-13T18:10:00.000Z";
const REASON = "counted delivery";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const levels = (reorderPoint: number): StockLevels => ({
  maximum: kilograms(20),
  reorderPoint,
  minimum: kilograms(8),
});

const openAlert = (): LevelAlert => ({
  id: ALERT_ID,
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: BEEF_ID,
  kind: SHORTAGE_KIND.LEVEL,
  severity: LEVEL_SEVERITY.RED,
  soldOut: false,
  status: LEVEL_ALERT_STATUS.OPEN,
  escalationClock: ESCALATION_CLOCK.RED,
  seenBy: null,
  seenAt: null,
  resolvedBy: null,
  resolvedAt: null,
  reason: null,
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

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

class MemoryShortageRepository extends ShortageRepository {
  readonly saved: LevelAlert[] = [];
  private readonly alerts = new Map<string, LevelAlert>();
  private readonly brands = new Map<string, BrandStockLevel>();
  private readonly locations = new Map<string, LocationStockLevel>();

  seed(alert: LevelAlert): void {
    this.alerts.set(alert.id, { ...alert });
  }

  async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(
      `${level.tenantId}:${level.brandId}:${level.ingredientId}`,
      {
        ...level,
      },
    );
  }

  async saveSiteLevel(): Promise<void> {}

  async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return this.brands.get(`${tenantId}:${brandId}:${ingredientId}`) ?? null;
  }

  async findSiteLevel(): Promise<null> {
    return null;
  }

  override async saveLocationLevel(level: LocationStockLevel): Promise<void> {
    this.locations.set(
      `${level.tenantId}:${level.locationId}:${level.ingredientId}`,
      { ...level },
    );
  }

  override async findLocationLevel(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<LocationStockLevel | null> {
    return (
      this.locations.get(`${tenantId}:${locationId}:${ingredientId}`) ?? null
    );
  }

  override async findLevelAlert(
    tenantId: string,
    alertId: string,
  ): Promise<LevelAlert | null> {
    const alert = this.alerts.get(alertId);

    if (!alert || alert.tenantId !== tenantId) {
      return null;
    }

    return { ...alert };
  }

  override async saveLevelAlert(alert: LevelAlert): Promise<void> {
    this.saved.push({ ...alert });
    this.alerts.set(alert.id, { ...alert });
  }
}

const harness = (onHand: number) => {
  const shortages = new MemoryShortageRepository();
  const events = new CapturedAudit();
  const resolve = new ResolveAlert(
    shortages,
    new PlatformShortageAudit(events),
  );

  return { shortages, events, resolve, tx: new ScriptedBalance(onHand) };
};

it("given an open alert and a balance above the reorder point, when it is resolved with a reason, then the alert resolves and the audit records that reason", async () => {
  const { shortages, events, resolve, tx } = harness(kilograms(16));
  const alert = openAlert();
  shortages.seed(alert);
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: BEEF_ID,
    ...levels(kilograms(15)),
  });

  const result = await resolve.execute(tx, {
    tenantId: TENANT_ID,
    venueId: SITE_A,
    alertId: ALERT_ID,
    actorId: ACTOR_ID,
    resolvedAt: RESOLVED_AT,
    reason: REASON,
  });

  const resolved = {
    ...alert,
    status: LEVEL_ALERT_STATUS.RESOLVED,
    reason: REASON,
    resolvedBy: ACTOR_ID,
    resolvedAt: RESOLVED_AT,
  };
  expect(result).toEqual(resolved);
  expect(shortages.saved).toEqual([resolved]);
  expect(tx.calls).toEqual([
    {
      tenantId: TENANT_ID,
      locationId: LOCATION_A,
      ingredientId: BEEF_ID,
    },
  ]);
  expect(events.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.resolve-shortage-alert",
      entity: ALERT_ID,
      before: alert,
      after: resolved,
      reason: REASON,
    },
  ]);
  expect(result).not.toHaveProperty("supplierId");
  expect(result).not.toHaveProperty("channel");
  expect(JSON.stringify(result)).not.toContain("NegativeStockOpened");
});

it("given an open alert at the reorder point, when resolve is requested with a reason, then nothing resolves", async () => {
  const { shortages, events, resolve, tx } = harness(kilograms(15));
  const alert = openAlert();
  shortages.seed(alert);
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: BEEF_ID,
    ...levels(kilograms(15)),
  });

  const result = await resolve.execute(tx, {
    tenantId: TENANT_ID,
    venueId: SITE_A,
    alertId: ALERT_ID,
    actorId: ACTOR_ID,
    resolvedAt: RESOLVED_AT,
    reason: REASON,
  });

  expect(result).toEqual(alert);
  expect(shortages.saved).toEqual([]);
  expect(events.commands).toEqual([]);
});

it("given a location reorder point above the brand, when the balance is between them, then nothing resolves", async () => {
  const { shortages, events, resolve, tx } = harness(kilograms(12));
  const alert = openAlert();
  shortages.seed(alert);
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: BEEF_ID,
    ...levels(kilograms(10)),
  });
  await shortages.saveLocationLevel({
    tenantId: TENANT_ID,
    locationId: LOCATION_A,
    ingredientId: BEEF_ID,
    ...levels(kilograms(15)),
  });

  const result = await resolve.execute(tx, {
    tenantId: TENANT_ID,
    venueId: SITE_A,
    alertId: ALERT_ID,
    actorId: ACTOR_ID,
    resolvedAt: RESOLVED_AT,
    reason: REASON,
  });

  expect(result).toEqual(alert);
  expect(shortages.saved).toEqual([]);
  expect(events.commands).toEqual([]);
});

it("given a balance above the reorder point, when resolve has no reason, then the alert stays open", async () => {
  const { shortages, events, resolve, tx } = harness(kilograms(16));
  const alert = openAlert();
  shortages.seed(alert);
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: BEEF_ID,
    ...levels(kilograms(15)),
  });

  const attempt = resolve.execute(tx, {
    tenantId: TENANT_ID,
    venueId: SITE_A,
    alertId: ALERT_ID,
    actorId: ACTOR_ID,
    resolvedAt: RESOLVED_AT,
    reason: "   ",
  });

  await expect(attempt).rejects.toThrow(ResolveReasonRequired);
  expect(shortages.saved).toEqual([]);
  expect(events.commands).toEqual([]);
});
