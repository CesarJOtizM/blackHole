import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  AcceptStockLevels,
  AcceptStockLevelsDenied,
  type AcceptStockLevelsInput,
} from "#application/accept-stock-levels/accept-stock-levels.js";
import {
  EvaluateStockLevels,
  type EvaluateStockLevelsInput,
} from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import {
  type BrandStockLevel,
  ShortageRepository,
  type ShortageTransaction,
  type SiteStockLevel,
  SUGGESTION_STATUS,
  type SuggestedStockLevel,
} from "#application/ports/shortage-repository.js";
import {
  ProposeStockLevels,
  type ProposeStockLevelsInput,
} from "#application/propose-stock-levels/propose-stock-levels.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY } from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const BEEF_ID = "ingredient_beef";
const SESSION_ID = "session_site_admin";
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

const acceptCommand = (suggestionId: string): AcceptStockLevelsInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  suggestionId,
  sessionId: SESSION_ID,
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

const activeBeef = (): SiteStockLevel => ({
  tenantId: TENANT_ID,
  venueId: SITE_A,
  ingredientId: BEEF_ID,
  maximum: kilograms(36),
  reorderPoint: kilograms(18),
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
  private suggestion: SuggestedStockLevel | null = null;
  private readonly flags = new Set<string>();

  async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(
      `${level.tenantId}:${level.brandId}:${level.ingredientId}`,
      { ...level },
    );
  }

  async saveSiteLevel(level: SiteStockLevel): Promise<void> {
    this.sites.set(`${level.tenantId}:${level.venueId}:${level.ingredientId}`, {
      ...level,
    });
  }

  async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return this.brands.get(`${tenantId}:${brandId}:${ingredientId}`) ?? null;
  }

  async findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
  ): Promise<SiteStockLevel | null> {
    return this.sites.get(`${tenantId}:${venueId}:${ingredientId}`) ?? null;
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
}

const ready = async (decision: Decision = allowed()) => {
  const shortages = new MemoryShortageRepository();
  const permissions = new ScriptedPermission(decision);
  const propose = new ProposeStockLevels(shortages);
  const accept = new AcceptStockLevels(shortages, permissions);
  const evaluate = new EvaluateStockLevels(shortages, new MemoryAudit());
  await shortages.saveBrandLevel(brandBeef());
  shortages.enableAlerts(TENANT_ID, SITE_A);
  const suggestion = await propose.execute(proposeCommand());
  return { shortages, permissions, accept, evaluate, suggestion };
};

it("given a pending beef proposal, when the administrator accepts it, then it becomes the active level and evaluation uses it", async () => {
  const { shortages, permissions, accept, evaluate, suggestion } =
    await ready();

  const stored = await accept.execute(acceptCommand(suggestion.id));

  expect(stored).toEqual(activeBeef());
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toEqual(
    activeBeef(),
  );
  expect(
    await shortages.findSuggestion(TENANT_ID, suggestion.id),
  ).toMatchObject({
    status: SUGGESTION_STATUS.ACTIVE,
    reorderPoint: kilograms(18),
    maximum: kilograms(36),
    minimum: kilograms(8),
  });
  expect(await shortages.findBrandLevel(TENANT_ID, BRAND_ID, BEEF_ID)).toEqual(
    brandBeef(),
  );
  const result = await evaluate.evaluate(
    new ScriptedBalance(kilograms(16)),
    evaluateCommand(),
  );
  expect(result).toMatchObject({
    written: true,
    action: "open",
    alert: {
      severity: LEVEL_SEVERITY.YELLOW,
      escalationClock: null,
    },
  });
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

it("given a session without inventory.configure-levels, when a pending proposal is accepted, then it stays pending and evaluation ignores it", async () => {
  const { shortages, permissions, accept, evaluate, suggestion } = await ready(
    denied(),
  );

  const attempt = accept.execute(acceptCommand(suggestion.id));

  await expect(attempt).rejects.toThrow(AcceptStockLevelsDenied);
  expect(permissions.inputs.map((input) => input.permission)).toEqual([
    PERMISSION.INVENTORY_CONFIGURE_LEVELS,
  ]);
  expect(await shortages.findSiteLevel(TENANT_ID, SITE_A, BEEF_ID)).toBeNull();
  expect(
    (await shortages.findSuggestion(TENANT_ID, suggestion.id))?.status,
  ).toBe(SUGGESTION_STATUS.PENDING);
  const result = await evaluate.evaluate(
    new ScriptedBalance(kilograms(16)),
    evaluateCommand(),
  );
  expect(result).toEqual({ written: false });
});
