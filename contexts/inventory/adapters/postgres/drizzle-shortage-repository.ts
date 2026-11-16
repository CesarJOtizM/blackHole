import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  coverageSettings,
  dishLevels,
  notificationRules,
  roleNotices,
  shortageAlerts,
  stockLevels,
  stockLevelTemplates,
  suggestedStockLevels,
} from "#adapters/postgres/schema.js";
import {
  type AlertDocument,
  type AlertDocumentKind,
  type BrandStockLevel,
  type CoverageAlert,
  type CoverageSettings,
  type DishAlert,
  type DishLevel,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type LevelAlertStatus,
  type LocationStockLevel,
  type NotificationRule,
  type OpenShortage,
  type RoleNotice,
  ShortageRepository,
  type ShortageTransaction,
  type SiteStockLevel,
  type SuggestedStockLevel,
  type SuggestionStatus,
} from "#application/ports/shortage-repository.js";
import {
  type EscalationClock,
  type LevelSeverity,
  SHORTAGE_KIND,
  type ShortageKind,
} from "#domain/shortage-alert.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type AlertRow = typeof shortageAlerts.$inferSelect;

const SITE_SCOPE = "site";
const LOCATION_SCOPE = "location";

const inTenant = async <T>(
  database: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE inventory_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );

    return work(tx);
  });

class PostgresShortageTransaction implements ShortageTransaction {
  constructor(
    readonly db: Transaction,
    readonly tenantId: string,
  ) {}

  balance(): Promise<number> {
    return Promise.resolve(0);
  }
}

const textOf = (value: string | null, label: string): string => {
  if (value === null) {
    throw new Error(`Shortage alert is missing ${label}.`);
  }

  return value;
};

const limitersOf = (value: string | null): string[] => {
  if (value === null) {
    return [];
  }

  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === "string");
};

const levelOf = (row: AlertRow): LevelAlert => ({
  id: row.id,
  tenantId: row.tenantId,
  brandId: textOf(row.brandId, "brand"),
  venueId: row.venueId,
  locationId: textOf(row.locationId, "location"),
  ingredientId: textOf(row.ingredientId, "ingredient"),
  kind: SHORTAGE_KIND.LEVEL,
  severity: textOf(row.severity, "severity") as LevelSeverity,
  soldOut: row.soldOut ?? false,
  status: row.status as LevelAlertStatus,
  escalationClock: (row.escalationClock as EscalationClock | null) ?? null,
  seenBy: row.seenBy,
  seenAt: row.seenAt,
  resolvedBy: row.resolvedBy,
  resolvedAt: row.resolvedAt,
  reason: row.reason,
});

const coverageOf = (row: AlertRow): CoverageAlert => ({
  id: row.id,
  tenantId: row.tenantId,
  brandId: textOf(row.brandId, "brand"),
  venueId: row.venueId,
  locationId: textOf(row.locationId, "location"),
  ingredientId: textOf(row.ingredientId, "ingredient"),
  kind: SHORTAGE_KIND.COVERAGE,
  hoursLeft: row.hoursLeft ?? 0,
  remainingServiceHours: row.remainingServiceHours ?? 0,
  status: row.status as LevelAlertStatus,
  escalationClock: null,
});

const dishOf = (row: AlertRow): DishAlert => ({
  id: row.id,
  tenantId: row.tenantId,
  venueId: row.venueId,
  productId: textOf(row.productId, "product"),
  kind: SHORTAGE_KIND.DISH,
  units: row.units ?? 0,
  minimum: row.minimum ?? 0,
  limiterIngredientIds: limitersOf(row.limiterIngredientIds),
  status: row.status as LevelAlertStatus,
  escalationClock: null,
});

const openRow = (row: AlertRow): OpenShortage => {
  if (row.kind === SHORTAGE_KIND.LEVEL) {
    return {
      kind: SHORTAGE_KIND.LEVEL,
      alert: levelOf(row),
      openedAt: row.openedAt,
    };
  }

  if (row.kind === SHORTAGE_KIND.COVERAGE) {
    return {
      kind: SHORTAGE_KIND.COVERAGE,
      alert: coverageOf(row),
      openedAt: row.openedAt,
    };
  }

  return {
    kind: SHORTAGE_KIND.DISH,
    alert: dishOf(row),
    openedAt: row.openedAt,
  };
};

export class DrizzleShortageRepository extends ShortageRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async inTransaction<T>(
    tenantId: string,
    work: (tx: ShortageTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(new PostgresShortageTransaction(tx, tenantId));
    });
  }

  override async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    await this.write(level.tenantId, undefined, async (tx) => {
      await tx
        .insert(stockLevelTemplates)
        .values(level)
        .onConflictDoUpdate({
          target: [
            stockLevelTemplates.tenantId,
            stockLevelTemplates.brandId,
            stockLevelTemplates.ingredientId,
          ],
          set: {
            maximum: level.maximum,
            reorderPoint: level.reorderPoint,
            minimum: level.minimum,
          },
        });
    });
  }

  override async saveSiteLevel(level: SiteStockLevel): Promise<void> {
    await this.write(level.tenantId, undefined, (tx) =>
      this.saveScopedLevel(tx, SITE_SCOPE, level.venueId, level),
    );
  }

  override async saveLocationLevel(level: LocationStockLevel): Promise<void> {
    await this.write(level.tenantId, undefined, (tx) =>
      this.saveScopedLevel(tx, LOCATION_SCOPE, level.locationId, level),
    );
  }

  override async saveDishLevel(level: DishLevel): Promise<void> {
    await this.write(level.tenantId, undefined, async (tx) => {
      await tx
        .insert(dishLevels)
        .values(level)
        .onConflictDoUpdate({
          target: [
            dishLevels.tenantId,
            dishLevels.venueId,
            dishLevels.productId,
          ],
          set: { minimum: level.minimum },
        });
    });
  }

  override async saveCoverageSettings(
    settings: CoverageSettings,
  ): Promise<void> {
    await this.write(settings.tenantId, undefined, async (tx) => {
      await tx
        .insert(coverageSettings)
        .values(settings)
        .onConflictDoUpdate({
          target: [coverageSettings.tenantId, coverageSettings.venueId],
          set: {
            weeks: settings.weeks,
            marginHours: settings.marginHours,
            slotMinutes: settings.slotMinutes,
            serviceStartMinute: settings.serviceStartMinute,
            serviceEndMinute: settings.serviceEndMinute,
          },
        });
    });
  }

  override async saveNotificationRule(rule: NotificationRule): Promise<void> {
    await this.write(rule.tenantId, undefined, async (tx) => {
      await tx
        .insert(notificationRules)
        .values({
          tenantId: rule.tenantId,
          venueId: rule.venueId,
          escalationMinutes: rule.escalationMinutes,
          shortageAlertsEnabled: false,
        })
        .onConflictDoUpdate({
          target: [notificationRules.tenantId, notificationRules.venueId],
          set: { escalationMinutes: rule.escalationMinutes },
        });
    });
  }

  override async saveAlertsEnabled(
    tenantId: string,
    venueId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.write(tenantId, undefined, async (tx) => {
      await tx
        .insert(notificationRules)
        .values({
          tenantId,
          venueId,
          escalationMinutes: null,
          shortageAlertsEnabled: enabled,
        })
        .onConflictDoUpdate({
          target: [notificationRules.tenantId, notificationRules.venueId],
          set: { shortageAlertsEnabled: enabled },
        });
    });
  }

  override async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(stockLevelTemplates)
        .where(
          and(
            eq(stockLevelTemplates.tenantId, tenantId),
            eq(stockLevelTemplates.brandId, brandId),
            eq(stockLevelTemplates.ingredientId, ingredientId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        tenantId: row.tenantId,
        brandId: row.brandId,
        ingredientId: row.ingredientId,
        maximum: row.maximum,
        reorderPoint: row.reorderPoint,
        minimum: row.minimum,
      };
    });
  }

  override async findSiteLevel(
    tenantId: string,
    venueId: string,
    ingredientId: string,
  ): Promise<SiteStockLevel | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.scopedLevel(
        tx,
        tenantId,
        SITE_SCOPE,
        venueId,
        ingredientId,
      );

      if (!row) {
        return null;
      }

      return {
        tenantId,
        venueId,
        ingredientId,
        maximum: row.maximum,
        reorderPoint: row.reorderPoint,
        minimum: row.minimum,
      };
    });
  }

  override async findLocationLevel(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<LocationStockLevel | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.scopedLevel(
        tx,
        tenantId,
        LOCATION_SCOPE,
        locationId,
        ingredientId,
      );

      if (!row) {
        return null;
      }

      return {
        tenantId,
        locationId,
        ingredientId,
        maximum: row.maximum,
        reorderPoint: row.reorderPoint,
        minimum: row.minimum,
      };
    });
  }

  override async findDishLevel(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<DishLevel | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(dishLevels)
        .where(
          and(
            eq(dishLevels.tenantId, tenantId),
            eq(dishLevels.venueId, venueId),
            eq(dishLevels.productId, productId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        tenantId: row.tenantId,
        venueId: row.venueId,
        productId: row.productId,
        minimum: row.minimum,
      };
    });
  }

  override async findCoverageSettings(
    tenantId: string,
    venueId: string,
  ): Promise<CoverageSettings | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(coverageSettings)
        .where(
          and(
            eq(coverageSettings.tenantId, tenantId),
            eq(coverageSettings.venueId, venueId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        tenantId: row.tenantId,
        venueId: row.venueId,
        weeks: row.weeks,
        marginHours: row.marginHours,
        slotMinutes: row.slotMinutes,
        serviceStartMinute: row.serviceStartMinute,
        serviceEndMinute: row.serviceEndMinute,
      };
    });
  }

  override async findNotificationRule(
    tenantId: string,
    venueId: string,
  ): Promise<NotificationRule | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(notificationRules)
        .where(
          and(
            eq(notificationRules.tenantId, tenantId),
            eq(notificationRules.venueId, venueId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        tenantId: row.tenantId,
        venueId: row.venueId,
        escalationMinutes: row.escalationMinutes,
      };
    });
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select({ enabled: notificationRules.shortageAlertsEnabled })
        .from(notificationRules)
        .where(
          and(
            eq(notificationRules.tenantId, tenantId),
            eq(notificationRules.venueId, venueId),
          ),
        )
        .limit(1);

      return rows[0]?.enabled ?? false;
    });
  }

  override async findOpenLevelAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<LevelAlert | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.openAlert(tx, tenantId, SHORTAGE_KIND.LEVEL, [
        eq(shortageAlerts.locationId, locationId),
        eq(shortageAlerts.ingredientId, ingredientId),
      ]);

      return row ? levelOf(row) : null;
    });
  }

  override async findLevelAlert(
    tenantId: string,
    alertId: string,
  ): Promise<LevelAlert | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.alertById(tx, tenantId, alertId);

      if (!row || row.kind !== SHORTAGE_KIND.LEVEL) {
        return null;
      }

      return levelOf(row);
    });
  }

  override async saveLevelAlert(
    alert: LevelAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    await this.write(alert.tenantId, tx, (db) =>
      this.saveAlert(db, {
        tenantId: alert.tenantId,
        id: alert.id,
        venueId: alert.venueId,
        kind: alert.kind,
        status: alert.status,
        brandId: alert.brandId,
        locationId: alert.locationId,
        ingredientId: alert.ingredientId,
        productId: null,
        severity: alert.severity,
        soldOut: alert.soldOut,
        escalationClock: alert.escalationClock,
        seenBy: alert.seenBy,
        seenAt: alert.seenAt,
        resolvedBy: alert.resolvedBy,
        resolvedAt: alert.resolvedAt,
        reason: alert.reason,
        hoursLeft: null,
        remainingServiceHours: null,
        units: null,
        minimum: null,
        limiterIngredientIds: null,
      }),
    );
  }

  override async findOpenCoverageAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<CoverageAlert | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.openAlert(tx, tenantId, SHORTAGE_KIND.COVERAGE, [
        eq(shortageAlerts.locationId, locationId),
        eq(shortageAlerts.ingredientId, ingredientId),
      ]);

      return row ? coverageOf(row) : null;
    });
  }

  override async saveCoverageAlert(
    alert: CoverageAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    await this.write(alert.tenantId, tx, (db) =>
      this.saveAlert(db, {
        tenantId: alert.tenantId,
        id: alert.id,
        venueId: alert.venueId,
        kind: alert.kind,
        status: alert.status,
        brandId: alert.brandId,
        locationId: alert.locationId,
        ingredientId: alert.ingredientId,
        productId: null,
        severity: null,
        soldOut: null,
        escalationClock: null,
        seenBy: null,
        seenAt: null,
        resolvedBy: null,
        resolvedAt: null,
        reason: null,
        hoursLeft: alert.hoursLeft,
        remainingServiceHours: alert.remainingServiceHours,
        units: null,
        minimum: null,
        limiterIngredientIds: null,
      }),
    );
  }

  override async findOpenDishAlert(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<DishAlert | null> {
    return this.read(tenantId, async (tx) => {
      const row = await this.openAlert(tx, tenantId, SHORTAGE_KIND.DISH, [
        eq(shortageAlerts.venueId, venueId),
        eq(shortageAlerts.productId, productId),
      ]);

      return row ? dishOf(row) : null;
    });
  }

  override async saveDishAlert(
    alert: DishAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    await this.write(alert.tenantId, tx, (db) =>
      this.saveAlert(db, {
        tenantId: alert.tenantId,
        id: alert.id,
        venueId: alert.venueId,
        kind: alert.kind,
        status: alert.status,
        brandId: null,
        locationId: null,
        ingredientId: null,
        productId: alert.productId,
        severity: null,
        soldOut: null,
        escalationClock: null,
        seenBy: null,
        seenAt: null,
        resolvedBy: null,
        resolvedAt: null,
        reason: null,
        hoursLeft: null,
        remainingServiceHours: null,
        units: alert.units,
        minimum: alert.minimum,
        limiterIngredientIds: JSON.stringify(alert.limiterIngredientIds),
      }),
    );
  }

  override async listOpenShortages(
    tenantId: string,
    venueId: string,
  ): Promise<OpenShortage[]> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(shortageAlerts)
        .where(
          and(
            eq(shortageAlerts.tenantId, tenantId),
            eq(shortageAlerts.venueId, venueId),
            ne(shortageAlerts.status, LEVEL_ALERT_STATUS.RESOLVED),
          ),
        )
        .orderBy(asc(shortageAlerts.id));

      return rows.map(openRow);
    });
  }

  override async listRoleNotices(
    tenantId: string,
    alertId: string,
  ): Promise<RoleNotice[]> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(roleNotices)
        .where(
          and(
            eq(roleNotices.tenantId, tenantId),
            eq(roleNotices.alertId, alertId),
          ),
        )
        .orderBy(asc(roleNotices.id));

      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        venueId: row.venueId,
        alertId: row.alertId,
        role: row.role,
        kind: row.kind as ShortageKind,
        severity: row.severity as LevelSeverity | null,
        notifiedAt: row.notifiedAt,
      }));
    });
  }

  override async saveRoleNotice(notice: RoleNotice): Promise<void> {
    await this.write(notice.tenantId, undefined, async (tx) => {
      await tx
        .delete(roleNotices)
        .where(
          and(
            eq(roleNotices.tenantId, notice.tenantId),
            eq(roleNotices.alertId, notice.alertId),
            eq(roleNotices.role, notice.role),
            ne(roleNotices.id, notice.id),
          ),
        );
      await tx
        .insert(roleNotices)
        .values({
          tenantId: notice.tenantId,
          id: notice.id,
          venueId: notice.venueId,
          alertId: notice.alertId,
          role: notice.role,
          kind: notice.kind,
          severity: notice.severity,
          notifiedAt: notice.notifiedAt,
        })
        .onConflictDoUpdate({
          target: [roleNotices.tenantId, roleNotices.id],
          set: {
            venueId: notice.venueId,
            alertId: notice.alertId,
            role: notice.role,
            kind: notice.kind,
            severity: notice.severity,
            notifiedAt: notice.notifiedAt,
          },
        });
    });
  }

  override async saveAlertDocument(document: AlertDocument): Promise<void> {
    await this.write(document.tenantId, undefined, async (tx) => {
      await tx
        .update(shortageAlerts)
        .set({
          documentId: document.documentId,
          documentKind: document.kind,
        })
        .where(
          and(
            eq(shortageAlerts.tenantId, document.tenantId),
            eq(shortageAlerts.id, document.alertId),
          ),
        );
    });
  }

  override async findAlertDocument(
    tenantId: string,
    alertId: string,
  ): Promise<AlertDocument | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select({
          documentId: shortageAlerts.documentId,
          documentKind: shortageAlerts.documentKind,
        })
        .from(shortageAlerts)
        .where(
          and(
            eq(shortageAlerts.tenantId, tenantId),
            eq(shortageAlerts.id, alertId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row?.documentId || !row.documentKind) {
        return null;
      }

      return {
        tenantId,
        alertId,
        documentId: row.documentId,
        kind: row.documentKind as AlertDocumentKind,
      };
    });
  }

  override async saveSuggestion(
    suggestion: SuggestedStockLevel,
  ): Promise<void> {
    await this.write(suggestion.tenantId, undefined, async (tx) => {
      await tx
        .insert(suggestedStockLevels)
        .values(suggestion)
        .onConflictDoUpdate({
          target: [suggestedStockLevels.tenantId, suggestedStockLevels.id],
          set: {
            brandId: suggestion.brandId,
            venueId: suggestion.venueId,
            locationId: suggestion.locationId,
            ingredientId: suggestion.ingredientId,
            maximum: suggestion.maximum,
            reorderPoint: suggestion.reorderPoint,
            minimum: suggestion.minimum,
            leadTimeDays: suggestion.leadTimeDays,
            status: suggestion.status,
          },
        });
    });
  }

  override async findSuggestion(
    tenantId: string,
    suggestionId: string,
  ): Promise<SuggestedStockLevel | null> {
    return this.read(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(suggestedStockLevels)
        .where(
          and(
            eq(suggestedStockLevels.tenantId, tenantId),
            eq(suggestedStockLevels.id, suggestionId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        tenantId: row.tenantId,
        brandId: row.brandId,
        venueId: row.venueId,
        locationId: row.locationId,
        ingredientId: row.ingredientId,
        maximum: row.maximum,
        reorderPoint: row.reorderPoint,
        minimum: row.minimum,
        leadTimeDays: row.leadTimeDays,
        status: row.status as SuggestionStatus,
      };
    });
  }

  private async read<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return inTenant(this.database, tenantId, work);
  }

  private async write(
    tenantId: string,
    tx: ShortageTransaction | undefined,
    work: (tx: Transaction) => Promise<void>,
  ): Promise<void> {
    if (tx instanceof PostgresShortageTransaction) {
      if (tx.tenantId !== tenantId) {
        return;
      }

      await work(tx.db);
      return;
    }

    await inTenant(this.database, tenantId, work);
  }

  private async saveScopedLevel(
    tx: Transaction,
    scope: string,
    scopeId: string,
    level: {
      tenantId: string;
      ingredientId: string;
      maximum: number;
      reorderPoint: number;
      minimum: number;
    },
  ): Promise<void> {
    const values = {
      tenantId: level.tenantId,
      scope,
      scopeId,
      ingredientId: level.ingredientId,
      maximum: level.maximum,
      reorderPoint: level.reorderPoint,
      minimum: level.minimum,
    };
    await tx
      .insert(stockLevels)
      .values(values)
      .onConflictDoUpdate({
        target: [
          stockLevels.tenantId,
          stockLevels.scope,
          stockLevels.scopeId,
          stockLevels.ingredientId,
        ],
        set: {
          maximum: level.maximum,
          reorderPoint: level.reorderPoint,
          minimum: level.minimum,
        },
      });
  }

  private async scopedLevel(
    tx: Transaction,
    tenantId: string,
    scope: string,
    scopeId: string,
    ingredientId: string,
  ) {
    const rows = await tx
      .select()
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.tenantId, tenantId),
          eq(stockLevels.scope, scope),
          eq(stockLevels.scopeId, scopeId),
          eq(stockLevels.ingredientId, ingredientId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private async alertById(
    tx: Transaction,
    tenantId: string,
    alertId: string,
  ): Promise<AlertRow | null> {
    const rows = await tx
      .select()
      .from(shortageAlerts)
      .where(
        and(
          eq(shortageAlerts.tenantId, tenantId),
          eq(shortageAlerts.id, alertId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private async openAlert(
    tx: Transaction,
    tenantId: string,
    kind: ShortageKind,
    filters: Parameters<typeof and>,
  ): Promise<AlertRow | null> {
    const rows = await tx
      .select()
      .from(shortageAlerts)
      .where(
        and(
          eq(shortageAlerts.tenantId, tenantId),
          eq(shortageAlerts.kind, kind),
          ne(shortageAlerts.status, LEVEL_ALERT_STATUS.RESOLVED),
          ...filters,
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private async saveAlert(
    tx: Transaction,
    alert: {
      tenantId: string;
      id: string;
      venueId: string;
      kind: ShortageKind;
      status: string;
      brandId: string | null;
      locationId: string | null;
      ingredientId: string | null;
      productId: string | null;
      severity: string | null;
      soldOut: boolean | null;
      escalationClock: string | null;
      seenBy: string | null;
      seenAt: string | null;
      resolvedBy: string | null;
      resolvedAt: string | null;
      reason: string | null;
      hoursLeft: number | null;
      remainingServiceHours: number | null;
      units: number | null;
      minimum: number | null;
      limiterIngredientIds: string | null;
    },
  ): Promise<void> {
    const openFilters = [
      eq(shortageAlerts.tenantId, alert.tenantId),
      eq(shortageAlerts.kind, alert.kind),
      ne(shortageAlerts.status, LEVEL_ALERT_STATUS.RESOLVED),
    ];

    if (alert.kind === SHORTAGE_KIND.DISH) {
      openFilters.push(eq(shortageAlerts.productId, alert.productId ?? ""));
    } else {
      openFilters.push(eq(shortageAlerts.locationId, alert.locationId ?? ""));
      openFilters.push(
        eq(shortageAlerts.ingredientId, alert.ingredientId ?? ""),
      );
    }

    const existing = await tx
      .select({ id: shortageAlerts.id, openedAt: shortageAlerts.openedAt })
      .from(shortageAlerts)
      .where(and(...openFilters))
      .limit(1);
    const openedAt = existing[0]?.openedAt ?? new Date().toISOString();

    if (alert.status !== LEVEL_ALERT_STATUS.RESOLVED) {
      await tx
        .delete(shortageAlerts)
        .where(and(...openFilters, ne(shortageAlerts.id, alert.id)));
    }

    await tx
      .insert(shortageAlerts)
      .values({
        ...alert,
        openedAt,
      })
      .onConflictDoUpdate({
        target: [shortageAlerts.tenantId, shortageAlerts.id],
        set: {
          venueId: alert.venueId,
          kind: alert.kind,
          status: alert.status,
          brandId: alert.brandId,
          locationId: alert.locationId,
          ingredientId: alert.ingredientId,
          productId: alert.productId,
          severity: alert.severity,
          soldOut: alert.soldOut,
          escalationClock: alert.escalationClock,
          seenBy: alert.seenBy,
          seenAt: alert.seenAt,
          resolvedBy: alert.resolvedBy,
          resolvedAt: alert.resolvedAt,
          reason: alert.reason,
          hoursLeft: alert.hoursLeft,
          remainingServiceHours: alert.remainingServiceHours,
          units: alert.units,
          minimum: alert.minimum,
          limiterIngredientIds: alert.limiterIngredientIds,
        },
      });
  }
}
