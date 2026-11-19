import {
  type AlertDocument,
  type BrandStockLevel,
  type CoverageAlert,
  type CoverageSettings,
  type DishAlert,
  type DishLevel,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type LocationStockLevel,
  type NotificationRule,
  type OpenShortage,
  type RoleNotice,
  ShortageRepository,
  type ShortageTransaction,
  type SiteStockLevel,
  type SuggestedStockLevel,
} from "#application/ports/shortage-repository.js";
import { SHORTAGE_KIND } from "#domain/shortage-alert.js";

const copy = <T>(value: T): T => structuredClone(value);

const venueKey = (tenantId: string, venueId: string): string =>
  `${tenantId}\u0000${venueId}`;

interface VenueRule {
  escalationMinutes: number | null;
  enabled: boolean;
}

interface StoredAlert {
  alert: LevelAlert | CoverageAlert | DishAlert;
  openedAt: string;
}

interface ShortageState {
  brands: Map<string, BrandStockLevel>;
  sites: Map<string, SiteStockLevel>;
  locations: Map<string, LocationStockLevel>;
  dishes: Map<string, DishLevel>;
  coverage: Map<string, CoverageSettings>;
  rules: Map<string, VenueRule>;
  alerts: Map<string, StoredAlert>;
  notices: RoleNotice[];
  documents: Map<string, AlertDocument>;
  suggestions: Map<string, SuggestedStockLevel>;
}

class MemoryShortageTransaction implements ShortageTransaction {
  readonly undos: Array<() => void> = [];

  constructor(readonly tenantId: string) {}

  balance(): Promise<number> {
    return Promise.resolve(0);
  }

  onRollback(undo: () => void): void {
    this.undos.push(undo);
  }
}

const brandKey = (level: {
  tenantId: string;
  brandId: string;
  ingredientId: string;
}): string =>
  `${level.tenantId}\u0000${level.brandId}\u0000${level.ingredientId}`;

const siteKey = (level: {
  tenantId: string;
  venueId: string;
  ingredientId: string;
}): string =>
  `${level.tenantId}\u0000${level.venueId}\u0000${level.ingredientId}`;

const locationKey = (level: {
  tenantId: string;
  locationId: string;
  ingredientId: string;
}): string =>
  `${level.tenantId}\u0000${level.locationId}\u0000${level.ingredientId}`;

const dishKey = (level: {
  tenantId: string;
  venueId: string;
  productId: string;
}): string => `${level.tenantId}\u0000${level.venueId}\u0000${level.productId}`;

const alertKey = (tenantId: string, id: string): string =>
  `${tenantId}\u0000${id}`;

const documentKey = (tenantId: string, alertId: string): string =>
  `${tenantId}\u0000${alertId}`;

export class InMemoryShortageRepository extends ShortageRepository {
  private brands = new Map<string, BrandStockLevel>();
  private sites = new Map<string, SiteStockLevel>();
  private locations = new Map<string, LocationStockLevel>();
  private dishes = new Map<string, DishLevel>();
  private coverage = new Map<string, CoverageSettings>();
  private rules = new Map<string, VenueRule>();
  private alerts = new Map<string, StoredAlert>();
  private notices: RoleNotice[] = [];
  private documents = new Map<string, AlertDocument>();
  private suggestions = new Map<string, SuggestedStockLevel>();

  override async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(brandKey(level), copy(level));
  }

  override async saveSiteLevel(level: SiteStockLevel): Promise<void> {
    this.sites.set(siteKey(level), copy(level));
  }

  override async saveLocationLevel(level: LocationStockLevel): Promise<void> {
    this.locations.set(locationKey(level), copy(level));
  }

  override async saveDishLevel(level: DishLevel): Promise<void> {
    this.dishes.set(dishKey(level), copy(level));
  }

  override async saveCoverageSettings(
    settings: CoverageSettings,
  ): Promise<void> {
    this.coverage.set(
      venueKey(settings.tenantId, settings.venueId),
      copy(settings),
    );
  }

  override async saveNotificationRule(rule: NotificationRule): Promise<void> {
    const key = venueKey(rule.tenantId, rule.venueId);
    const current = this.rules.get(key);
    this.rules.set(key, {
      escalationMinutes: rule.escalationMinutes,
      enabled: current?.enabled ?? false,
    });
  }

  override async saveAlertsEnabled(
    tenantId: string,
    venueId: string,
    enabled: boolean,
  ): Promise<void> {
    const key = venueKey(tenantId, venueId);
    const current = this.rules.get(key);
    this.rules.set(key, {
      escalationMinutes: current?.escalationMinutes ?? null,
      enabled,
    });
  }

  override async inTransaction<T>(
    tenantId: string,
    work: (tx: ShortageTransaction) => Promise<T>,
  ): Promise<T> {
    const tx = new MemoryShortageTransaction(tenantId);

    try {
      return await work(tx);
    } catch (error) {
      for (const undo of tx.undos.reverse()) {
        undo();
      }

      throw error;
    }
  }

  override async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return copy(
      this.brands.get(brandKey({ tenantId, brandId, ingredientId })) ?? null,
    );
  }

  override async findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
  ): Promise<SiteStockLevel | null> {
    return copy(
      this.sites.get(siteKey({ tenantId, venueId, ingredientId })) ?? null,
    );
  }

  override async findLocationLevel(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<LocationStockLevel | null> {
    return copy(
      this.locations.get(locationKey({ tenantId, locationId, ingredientId })) ??
        null,
    );
  }

  override async findDishLevel(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<DishLevel | null> {
    return copy(
      this.dishes.get(dishKey({ tenantId, venueId, productId })) ?? null,
    );
  }

  override async findCoverageSettings(
    tenantId: string,
    venueId: string,
  ): Promise<CoverageSettings | null> {
    return copy(this.coverage.get(venueKey(tenantId, venueId)) ?? null);
  }

  override async findNotificationRule(
    tenantId: string,
    venueId: string,
  ): Promise<NotificationRule | null> {
    const rule = this.rules.get(venueKey(tenantId, venueId));

    if (!rule) {
      return null;
    }

    return {
      tenantId,
      venueId,
      escalationMinutes: rule.escalationMinutes,
    };
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.rules.get(venueKey(tenantId, venueId))?.enabled ?? false;
  }

  override async findOpenLevelAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<LevelAlert | null> {
    return this.openLevel(tenantId, locationId, ingredientId);
  }

  override async findLevelAlert(
    tenantId: string,
    alertId: string,
  ): Promise<LevelAlert | null> {
    const stored = this.alerts.get(alertKey(tenantId, alertId));

    if (!stored || stored.alert.kind !== SHORTAGE_KIND.LEVEL) {
      return null;
    }

    return copy(stored.alert);
  }

  override async saveLevelAlert(
    alert: LevelAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!this.accepts(tx, alert.tenantId)) {
      return;
    }

    this.change(tx, () => {
      this.replaceOpen(alert, (stored) => this.sameLevel(stored, alert));
    });
  }

  override async findOpenCoverageAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<CoverageAlert | null> {
    for (const stored of this.alerts.values()) {
      if (
        stored.alert.kind === SHORTAGE_KIND.COVERAGE &&
        stored.alert.tenantId === tenantId &&
        stored.alert.locationId === locationId &&
        stored.alert.ingredientId === ingredientId &&
        stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED
      ) {
        return copy(stored.alert);
      }
    }

    return null;
  }

  override async saveCoverageAlert(
    alert: CoverageAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!this.accepts(tx, alert.tenantId)) {
      return;
    }

    this.change(tx, () => {
      this.replaceOpen(
        alert,
        (stored) =>
          stored.alert.kind === SHORTAGE_KIND.COVERAGE &&
          stored.alert.tenantId === alert.tenantId &&
          stored.alert.locationId === alert.locationId &&
          stored.alert.ingredientId === alert.ingredientId &&
          stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED,
      );
    });
  }

  override async findOpenDishAlert(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<DishAlert | null> {
    for (const stored of this.alerts.values()) {
      if (
        stored.alert.kind === SHORTAGE_KIND.DISH &&
        stored.alert.tenantId === tenantId &&
        stored.alert.venueId === venueId &&
        stored.alert.productId === productId &&
        stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED
      ) {
        return copy(stored.alert);
      }
    }

    return null;
  }

  override async saveDishAlert(
    alert: DishAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!this.accepts(tx, alert.tenantId)) {
      return;
    }

    this.change(tx, () => {
      this.replaceOpen(
        alert,
        (stored) =>
          stored.alert.kind === SHORTAGE_KIND.DISH &&
          stored.alert.tenantId === alert.tenantId &&
          stored.alert.venueId === alert.venueId &&
          stored.alert.productId === alert.productId &&
          stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED,
      );
    });
  }

  override async listOpenShortages(
    tenantId: string,
    venueId: string,
  ): Promise<OpenShortage[]> {
    const rows: OpenShortage[] = [];

    for (const stored of this.alerts.values()) {
      if (
        stored.alert.tenantId !== tenantId ||
        stored.alert.venueId !== venueId ||
        stored.alert.status === LEVEL_ALERT_STATUS.RESOLVED
      ) {
        continue;
      }

      rows.push(this.openRow(stored));
    }

    return rows.toSorted((left, right) =>
      left.alert.id.localeCompare(right.alert.id),
    );
  }

  override async listRoleNotices(
    tenantId: string,
    alertId: string,
  ): Promise<RoleNotice[]> {
    return this.notices
      .filter(
        (notice) => notice.tenantId === tenantId && notice.alertId === alertId,
      )
      .map((notice) => copy(notice));
  }

  override async saveRoleNotice(notice: RoleNotice): Promise<void> {
    this.notices = this.notices.filter(
      (stored) =>
        stored.tenantId !== notice.tenantId ||
        stored.alertId !== notice.alertId ||
        stored.role !== notice.role,
    );
    this.notices.push(copy(notice));
  }

  override async saveAlertDocument(document: AlertDocument): Promise<void> {
    this.documents.set(
      documentKey(document.tenantId, document.alertId),
      copy(document),
    );
  }

  override async findAlertDocument(
    tenantId: string,
    alertId: string,
  ): Promise<AlertDocument | null> {
    return copy(this.documents.get(documentKey(tenantId, alertId)) ?? null);
  }

  override async saveSuggestion(
    suggestion: SuggestedStockLevel,
  ): Promise<void> {
    this.suggestions.set(
      alertKey(suggestion.tenantId, suggestion.id),
      copy(suggestion),
    );
  }

  override async findSuggestion(
    tenantId: string,
    suggestionId: string,
  ): Promise<SuggestedStockLevel | null> {
    return copy(this.suggestions.get(alertKey(tenantId, suggestionId)) ?? null);
  }

  private accepts(
    tx: ShortageTransaction | undefined,
    tenantId: string,
  ): boolean {
    return (
      !(tx instanceof MemoryShortageTransaction) || tx.tenantId === tenantId
    );
  }

  private change(tx: ShortageTransaction | undefined, apply: () => void): void {
    const snapshot = this.capture();
    apply();
    tx?.onRollback?.(() => {
      this.restore(snapshot);
    });
  }

  private replaceOpen(
    alert: LevelAlert | CoverageAlert | DishAlert,
    sameOpen: (stored: StoredAlert) => boolean,
  ): void {
    let openedAt: string | undefined;

    if (alert.status !== LEVEL_ALERT_STATUS.RESOLVED) {
      for (const [key, stored] of this.alerts) {
        if (!sameOpen(stored)) {
          continue;
        }

        openedAt = openedAt ?? stored.openedAt;
        this.alerts.delete(key);
      }
    }

    this.alerts.set(alertKey(alert.tenantId, alert.id), {
      alert: copy(alert),
      openedAt: openedAt ?? new Date().toISOString(),
    });
  }

  private sameLevel(stored: StoredAlert, alert: LevelAlert): boolean {
    return (
      stored.alert.kind === SHORTAGE_KIND.LEVEL &&
      stored.alert.tenantId === alert.tenantId &&
      stored.alert.locationId === alert.locationId &&
      stored.alert.ingredientId === alert.ingredientId &&
      stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED
    );
  }

  private openLevel(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): LevelAlert | null {
    for (const stored of this.alerts.values()) {
      if (
        stored.alert.kind === SHORTAGE_KIND.LEVEL &&
        stored.alert.tenantId === tenantId &&
        stored.alert.locationId === locationId &&
        stored.alert.ingredientId === ingredientId &&
        stored.alert.status !== LEVEL_ALERT_STATUS.RESOLVED
      ) {
        return copy(stored.alert);
      }
    }

    return null;
  }

  private openRow(stored: StoredAlert): OpenShortage {
    if (stored.alert.kind === SHORTAGE_KIND.LEVEL) {
      return {
        kind: SHORTAGE_KIND.LEVEL,
        alert: copy(stored.alert),
        openedAt: stored.openedAt,
      };
    }

    if (stored.alert.kind === SHORTAGE_KIND.COVERAGE) {
      return {
        kind: SHORTAGE_KIND.COVERAGE,
        alert: copy(stored.alert),
        openedAt: stored.openedAt,
      };
    }

    return {
      kind: SHORTAGE_KIND.DISH,
      alert: copy(stored.alert),
      openedAt: stored.openedAt,
    };
  }

  private capture(): ShortageState {
    return {
      brands: new Map(this.brands),
      sites: new Map(this.sites),
      locations: new Map(this.locations),
      dishes: new Map(this.dishes),
      coverage: new Map(this.coverage),
      rules: new Map(this.rules),
      alerts: new Map(
        [...this.alerts].map(([key, value]) => [key, structuredClone(value)]),
      ),
      notices: this.notices.map((notice) => copy(notice)),
      documents: new Map(this.documents),
      suggestions: new Map(this.suggestions),
    };
  }

  private restore(state: ShortageState): void {
    this.brands = state.brands;
    this.sites = state.sites;
    this.locations = state.locations;
    this.dishes = state.dishes;
    this.coverage = state.coverage;
    this.rules = state.rules;
    this.alerts = state.alerts;
    this.notices = state.notices;
    this.documents = state.documents;
    this.suggestions = state.suggestions;
  }
}
