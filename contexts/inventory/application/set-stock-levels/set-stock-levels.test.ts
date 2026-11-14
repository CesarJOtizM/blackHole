import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  type BrandStockLevel,
  ShortageRepository,
  type SiteStockLevel,
} from "#application/ports/shortage-repository.js";
import {
  SetStockLevels,
  type SetStockLevelsInput,
  StockLevelsDenied,
} from "#application/set-stock-levels/set-stock-levels.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  InvalidStockLevels,
  type StockLevels,
} from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const SITE_B = "organization_venue_b";
const BEEF_ID = "ingredient_beef";
const SESSION_ID = "session_site_admin";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const levels = (reorderPoint: number): StockLevels => ({
  maximum: kilograms(20),
  reorderPoint,
  minimum: kilograms(8),
});

const command = (
  venueId: string,
  reorderPoint: number,
): SetStockLevelsInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId,
  ingredientId: BEEF_ID,
  sessionId: SESSION_ID,
  ...levels(reorderPoint),
});

const brandBeef = (reorderPoint: number): BrandStockLevel => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  ...levels(reorderPoint),
});

const siteBeef = (venueId: string, reorderPoint: number): SiteStockLevel => ({
  tenantId: TENANT_ID,
  venueId,
  ingredientId: BEEF_ID,
  ...levels(reorderPoint),
});

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;

const allowed = (): Decision => ({
  outcome: "allowed",
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: PermissionInput[] = [];

  constructor(private readonly decision: Decision) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: PermissionInput) {
    this.inputs.push(input);
    return this.decision;
  }
}

class MemoryShortageRepository extends ShortageRepository {
  private readonly brands = new Map<string, BrandStockLevel>();
  private readonly sites = new Map<string, SiteStockLevel>();

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

const effectiveLevels = async (
  shortages: MemoryShortageRepository,
  venueId: string,
): Promise<StockLevels | null> => {
  const site = await shortages.findSiteLevel(TENANT_ID, venueId, BEEF_ID);

  if (site) {
    return {
      maximum: site.maximum,
      reorderPoint: site.reorderPoint,
      minimum: site.minimum,
    };
  }

  const brand = await shortages.findBrandLevel(TENANT_ID, BRAND_ID, BEEF_ID);

  if (!brand) {
    return null;
  }

  return {
    maximum: brand.maximum,
    reorderPoint: brand.reorderPoint,
    minimum: brand.minimum,
  };
};

it("given a brand reorder point of 10 kg for beef, when site A sets 15 kg, then only site A stores that override", async () => {
  const shortages = new MemoryShortageRepository();
  const permissions = new ScriptedPermission(allowed());
  const setLevels = new SetStockLevels(shortages, permissions);
  await shortages.saveBrandLevel(brandBeef(kilograms(10)));

  const stored = await setLevels.execute(command(SITE_A, kilograms(15)));

  expect(stored).toEqual(siteBeef(SITE_A, kilograms(15)));
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toEqual(
    siteBeef(SITE_A, kilograms(15)),
  );
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_B, BEEF_ID)).toBeNull();
  expect(await shortages.findBrandLevel(TENANT_ID, BRAND_ID, BEEF_ID)).toEqual(
    brandBeef(kilograms(10)),
  );
  expect(await effectiveLevels(shortages, SITE_A)).toEqual(
    levels(kilograms(15)),
  );
  expect(await effectiveLevels(shortages, SITE_B)).toEqual(
    levels(kilograms(10)),
  );
  expect(permissions.inputs).toEqual([
    {
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      permission: PERMISSION.INVENTORY_CONFIGURE_LEVELS,
      target: { kind: "site", id: SITE_A, brandId: BRAND_ID },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    },
  ]);
});

it("given a minimum of 8 kg, when the reorder point is set to 5 kg, then the change is rejected", async () => {
  const shortages = new MemoryShortageRepository();
  const permissions = new ScriptedPermission(allowed());
  const setLevels = new SetStockLevels(shortages, permissions);
  await shortages.saveBrandLevel(brandBeef(kilograms(10)));

  const attempt = setLevels.execute(command(SITE_A, kilograms(5)));

  await expect(attempt).rejects.toThrow(InvalidStockLevels);
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toBeNull();
  expect(await shortages.findBrandLevel(TENANT_ID, BRAND_ID, BEEF_ID)).toEqual(
    brandBeef(kilograms(10)),
  );
});

it("given a session without inventory.configure-levels, when stock levels are set, then the change is rejected", async () => {
  const shortages = new MemoryShortageRepository();
  const permissions = new ScriptedPermission(denied());
  const setLevels = new SetStockLevels(shortages, permissions);

  const attempt = setLevels.execute(command(SITE_A, kilograms(15)));

  await expect(attempt).rejects.toThrow(StockLevelsDenied);
  expect(permissions.inputs.map((input) => input.permission)).toEqual([
    PERMISSION.INVENTORY_CONFIGURE_LEVELS,
  ]);
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toBeNull();
});
