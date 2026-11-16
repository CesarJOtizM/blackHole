import type {
  EscalationClock,
  LevelSeverity,
  SHORTAGE_KIND,
  ShortageKind,
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
  onRollback?(undo: () => void): void;
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

export interface CoverageSettings {
  tenantId: string;
  venueId: string;
  weeks: number | null;
  marginHours: number | null;
  slotMinutes: number | null;
  serviceStartMinute: number | null;
  serviceEndMinute: number | null;
}

export interface CoverageAlert {
  id: string;
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  kind: typeof SHORTAGE_KIND.COVERAGE;
  hoursLeft: number;
  remainingServiceHours: number;
  status: LevelAlertStatus;
  escalationClock: null;
}

export interface DishLevel {
  tenantId: string;
  venueId: string;
  productId: string;
  minimum: number;
}

export interface DishAlert {
  id: string;
  tenantId: string;
  venueId: string;
  productId: string;
  kind: typeof SHORTAGE_KIND.DISH;
  units: number;
  minimum: number;
  limiterIngredientIds: readonly string[];
  status: LevelAlertStatus;
  escalationClock: null;
}

export interface NotificationRule {
  tenantId: string;
  venueId: string;
  escalationMinutes: number | null;
}

export interface RoleNotice {
  id: string;
  tenantId: string;
  venueId: string;
  alertId: string;
  role: string;
  kind: ShortageKind;
  severity: LevelSeverity | null;
  notifiedAt: string;
}

export const ALERT_DOCUMENT_KIND = {
  TRANSFER: "transfer",
  PURCHASE_ORDER: "purchase-order",
} as const;

export type AlertDocumentKind =
  (typeof ALERT_DOCUMENT_KIND)[keyof typeof ALERT_DOCUMENT_KIND];

export interface AlertDocument {
  tenantId: string;
  alertId: string;
  documentId: string;
  kind: AlertDocumentKind;
}

export const SUGGESTION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
} as const;

export type SuggestionStatus =
  (typeof SUGGESTION_STATUS)[keyof typeof SUGGESTION_STATUS];

export interface SuggestedStockLevel {
  id: string;
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  maximum: number;
  reorderPoint: number;
  minimum: number;
  leadTimeDays: number;
  status: SuggestionStatus;
}

export type OpenShortage =
  | {
      readonly kind: typeof SHORTAGE_KIND.LEVEL;
      readonly alert: LevelAlert;
      readonly openedAt: string;
    }
  | {
      readonly kind: typeof SHORTAGE_KIND.COVERAGE;
      readonly alert: CoverageAlert;
      readonly openedAt: string;
    }
  | {
      readonly kind: typeof SHORTAGE_KIND.DISH;
      readonly alert: DishAlert;
      readonly openedAt: string;
    };

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

  saveDishLevel(_level: DishLevel): Promise<void> {
    return Promise.resolve();
  }

  saveCoverageSettings(_settings: CoverageSettings): Promise<void> {
    return Promise.resolve();
  }

  saveNotificationRule(_rule: NotificationRule): Promise<void> {
    return Promise.resolve();
  }

  saveAlertsEnabled(
    _tenantId: string,
    _venueId: string,
    _enabled: boolean,
  ): Promise<void> {
    return Promise.resolve();
  }

  inTransaction<T>(
    _tenantId: string,
    work: (tx: ShortageTransaction) => Promise<T>,
  ): Promise<T> {
    return work({
      balance: () => Promise.resolve(0),
    });
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

  findCoverageSettings(
    _tenantId: string,
    _venueId: string,
    _tx?: ShortageTransaction,
  ): Promise<CoverageSettings | null> {
    return Promise.resolve(null);
  }

  findOpenCoverageAlert(
    _tenantId: string,
    _locationId: string,
    _ingredientId: string,
    _tx?: ShortageTransaction,
  ): Promise<CoverageAlert | null> {
    return Promise.resolve(null);
  }

  saveCoverageAlert(
    _alert: CoverageAlert,
    _tx?: ShortageTransaction,
  ): Promise<void> {
    return Promise.resolve();
  }

  findDishLevel(
    _tenantId: string,
    _venueId: string,
    _productId: string,
    _tx?: ShortageTransaction,
  ): Promise<DishLevel | null> {
    return Promise.resolve(null);
  }

  findOpenDishAlert(
    _tenantId: string,
    _venueId: string,
    _productId: string,
    _tx?: ShortageTransaction,
  ): Promise<DishAlert | null> {
    return Promise.resolve(null);
  }

  saveDishAlert(_alert: DishAlert, _tx?: ShortageTransaction): Promise<void> {
    return Promise.resolve();
  }

  findNotificationRule(
    _tenantId: string,
    _venueId: string,
  ): Promise<NotificationRule | null> {
    return Promise.resolve(null);
  }

  listOpenShortages(
    _tenantId: string,
    _venueId: string,
  ): Promise<OpenShortage[]> {
    return Promise.resolve([]);
  }

  listRoleNotices(_tenantId: string, _alertId: string): Promise<RoleNotice[]> {
    return Promise.resolve([]);
  }

  saveRoleNotice(_notice: RoleNotice): Promise<void> {
    return Promise.resolve();
  }

  saveAlertDocument(_document: AlertDocument): Promise<void> {
    return Promise.resolve();
  }

  findAlertDocument(
    _tenantId: string,
    _alertId: string,
  ): Promise<AlertDocument | null> {
    return Promise.resolve(null);
  }

  saveSuggestion(_suggestion: SuggestedStockLevel): Promise<void> {
    return Promise.resolve();
  }

  findSuggestion(
    _tenantId: string,
    _suggestionId: string,
  ): Promise<SuggestedStockLevel | null> {
    return Promise.resolve(null);
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
