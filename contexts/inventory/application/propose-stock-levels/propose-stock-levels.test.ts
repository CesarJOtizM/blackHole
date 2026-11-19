import { expect, it } from "vitest";
import {
  EvaluateStockLevels,
  type EvaluateStockLevelsInput,
} from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import {
  type BrandStockLevel,
  ShortageRepository,
  type ShortageTransaction,
  type SiteStockLevel,
  type SuggestedStockLevel,
} from "#application/ports/shortage-repository.js";
import {
  ProposeStockLevels,
  type ProposeStockLevelsInput,
} from "#application/propose-stock-levels/propose-stock-levels.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const BEEF_ID = "ingredient_beef";
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const proposeCommand = (): ProposeStockLevelsInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: BEEF_ID,
  dailyConsumption: kilograms(2),
  leadTimeDays: 9,
});

const evaluateCommand = (): EvaluateStockLevelsInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: BEEF_ID,
  occurredAt: OCCURRED_AT,
});

const brandBeef = (): BrandStockLevel => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  maximum: kilograms(20),
  reorderPoint: kilograms(15),
  minimum: kilograms(8),
});

class ScriptedBalance implements ShortageTransaction {
  constructor(private readonly onHand: number) {}

  async balance(): Promise<number> {
    return this.onHand;
  }
}

class MemoryAudit {
  async record(): Promise<void> {
    return undefined;
  }
}

class MemoryShortageRepository extends ShortageRepository {
  private readonly brands = new Map<string, BrandStockLevel>();
  private readonly sites = new Map<string, SiteStockLevel>();
  private suggestion: SuggestedStockLevel | null = null;
  private readonly flags = new Set<string>();

  async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(this.brandKey(level), { ...level });
  }

  async saveSiteLevel(level: SiteStockLevel): Promise<void> {
    this.sites.set(this.siteKey(level), { ...level });
  }

  async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return (
      this.brands.get(this.brandKey({ tenantId, brandId, ingredientId })) ??
      null
    );
  }

  async findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
  ): Promise<SiteStockLevel | null> {
    return (
      this.sites.get(this.siteKey({ tenantId, venueId, ingredientId })) ?? null
    );
  }

  enableAlerts(tenantId: string, venueId: string): void {
    this.flags.add(`${tenantId}:${venueId}`);
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.flags.has(`${tenantId}:${venueId}`);
  }

  override async saveSuggestion(
    suggestion: SuggestedStockLevel,
  ): Promise<void> {
    this.suggestion = { ...suggestion };
  }

  override async findSuggestion(
    tenantId: string,
    suggestionId: string,
  ): Promise<SuggestedStockLevel | null> {
    if (
      !this.suggestion ||
      this.suggestion.tenantId !== tenantId ||
      this.suggestion.id !== suggestionId
    ) {
      return null;
    }

    return { ...this.suggestion };
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
}

it("given an unaccepted beef proposal from consumption and lead time, when evaluation runs, then the proposal stays pending and the active reorder point is used", async () => {
  const shortages = new MemoryShortageRepository();
  const propose = new ProposeStockLevels(shortages);
  const evaluate = new EvaluateStockLevels(shortages, new MemoryAudit());
  await shortages.saveBrandLevel(brandBeef());
  shortages.enableAlerts(TENANT_ID, SITE_A);

  const suggestion = await propose.execute(proposeCommand());

  expect(suggestion).toMatchObject({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    venueId: SITE_A,
    locationId: LOCATION_A,
    ingredientId: BEEF_ID,
    maximum: kilograms(36),
    reorderPoint: kilograms(18),
    minimum: kilograms(8),
    leadTimeDays: 9,
    status: "pending",
  });
  expect(await shortages.findSuggestion(TENANT_ID, suggestion.id)).toEqual(
    suggestion,
  );
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toBeNull();
  expect(await shortages.findBrandLevel(TENANT_ID, BRAND_ID, BEEF_ID)).toEqual(
    brandBeef(),
  );
  const result = await evaluate.evaluate(
    new ScriptedBalance(kilograms(16)),
    evaluateCommand(),
  );
  expect(result).toEqual({ written: false });
  expect(suggestion.reorderPoint).toBeGreaterThan(brandBeef().reorderPoint);
  expect(kilograms(16)).toBeGreaterThan(brandBeef().reorderPoint);
});
