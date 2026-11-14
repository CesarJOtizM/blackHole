import type {
  EscalationClock,
  LevelSeverity,
  SHORTAGE_KIND,
  StockLevels,
} from "#domain/shortage-alert.js";

export interface BrandStockLevel extends StockLevels {
  tenantId: string;
  brandId: string;
  ingredientId: string;
}

export interface SiteStockLevel extends StockLevels {
  tenantId: string;
  venueId: string;
  ingredientId: string;
}

export interface LocationStockLevel extends StockLevels {
  tenantId: string;
  locationId: string;
  ingredientId: string;
}

export interface ShortageTransaction {
  balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
}

export interface StockLevelScope {
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
}

export const LEVEL_ALERT_STATUS = {
  OPEN: "open",
  SEEN: "seen",
  RESOLVED: "resolved",
} as const;

export type LevelAlertStatus =
  (typeof LEVEL_ALERT_STATUS)[keyof typeof LEVEL_ALERT_STATUS];

export interface LevelAlert {
  id: string;
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  kind: typeof SHORTAGE_KIND.LEVEL;
  severity: LevelSeverity;
  soldOut: boolean;
  status: LevelAlertStatus;
  escalationClock: EscalationClock | null;
  seenBy: string | null;
  seenAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reason: string | null;
}

const levelsOf = (level: StockLevels): StockLevels => ({
  maximum: level.maximum,
  reorderPoint: level.reorderPoint,
  minimum: level.minimum,
});

export abstract class ShortageRepository {
  abstract saveBrandLevel(level: BrandStockLevel): Promise<void>;

  abstract saveSiteLevel(level: SiteStockLevel): Promise<void>;

  abstract findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<BrandStockLevel | null>;

  abstract findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
    tx?: ShortageTransaction,
  ): Promise<SiteStockLevel | null>;

  saveLocationLevel(_level: LocationStockLevel): Promise<void> {
    return Promise.resolve();
  }

  findLocationLevel(
    _tenantId: string,
    _locationId: string,
    _ingredientId: string,
    _tx?: ShortageTransaction,
  ): Promise<LocationStockLevel | null> {
    return Promise.resolve(null);
  }

  alertsEnabled(
    _tenantId: string,
    _venueId: string,
    _tx?: ShortageTransaction,
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  findOpenLevelAlert(
    _tenantId: string,
    _locationId: string,
    _ingredientId: string,
    _tx?: ShortageTransaction,
  ): Promise<LevelAlert | null> {
    return Promise.resolve(null);
  }

  findLevelAlert(
    _tenantId: string,
    _alertId: string,
    _tx?: ShortageTransaction,
  ): Promise<LevelAlert | null> {
    return Promise.resolve(null);
  }

  saveLevelAlert(_alert: LevelAlert, _tx?: ShortageTransaction): Promise<void> {
    return Promise.resolve();
  }

  async effectiveLevels(
    scope: StockLevelScope,
    tx?: ShortageTransaction,
  ): Promise<StockLevels | null> {
    const location = await this.findLocationLevel(
      scope.tenantId,
      scope.locationId,
      scope.ingredientId,
      tx,
    );

    if (location) {
      return levelsOf(location);
    }

    const site = await this.findSiteLevel(
      scope.tenantId,
      scope.venueId,
      scope.ingredientId,
      tx,
    );

    if (site) {
      return levelsOf(site);
    }

    const brand = await this.findBrandLevel(
      scope.tenantId,
      scope.brandId,
      scope.ingredientId,
      tx,
    );

    if (!brand) {
      return null;
    }

    return levelsOf(brand);
  }
}
