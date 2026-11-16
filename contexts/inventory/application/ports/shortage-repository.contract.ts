import { expect, it } from "vitest";

import { InMemoryShortageRepository } from "#adapters/memory/in-memory-shortage-repository.js";
import {
  ALERT_DOCUMENT_KIND,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type ShortageRepository,
  type ShortageTransaction,
  SUGGESTION_STATUS,
} from "#application/ports/shortage-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY, SHORTAGE_KIND } from "#domain/shortage-alert.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const BRAND_ID = "organization_brand_1";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const INGREDIENT_ID = "ingredient_beef";
const PRODUCT_ID = "product_burger";
const OPENED_AT = "2026-11-13T18:00:00.000Z";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const brandLevels = {
  maximum: grams(20),
  reorderPoint: grams(15),
  minimum: grams(8),
};

const siteLevels = {
  maximum: grams(20),
  reorderPoint: grams(12),
  minimum: grams(8),
};

const locationLevels = {
  maximum: grams(20),
  reorderPoint: grams(9),
  minimum: grams(4),
};

export interface ShortageContractSubject {
  repository: ShortageRepository;
  inTransaction<T>(
    tenantId: string,
    work: (tx: ShortageTransaction) => Promise<T>,
  ): Promise<T>;
}

const levelAlert = (
  id: string,
  severity: LevelAlert["severity"],
): LevelAlert => ({
  id,
  tenantId: TENANT_A,
  brandId: BRAND_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: INGREDIENT_ID,
  kind: SHORTAGE_KIND.LEVEL,
  severity,
  soldOut: severity === LEVEL_SEVERITY.CRITICAL,
  status: LEVEL_ALERT_STATUS.OPEN,
  escalationClock: severity === LEVEL_SEVERITY.YELLOW ? null : "red",
  seenBy: null,
  seenAt: null,
  resolvedBy: null,
  resolvedAt: null,
  reason: null,
});

export function shortageRepositoryContract(
  open: () => ShortageContractSubject | Promise<ShortageContractSubject>,
): void {
  it("given shortage rows stored for tenant A, when tenant B reads them, then tenant A stays hidden", async () => {
    const { repository } = await open();
    const alert = levelAlert("level_beef_yellow", LEVEL_SEVERITY.YELLOW);
    const coverage = {
      id: "coverage_beef",
      tenantId: TENANT_A,
      brandId: BRAND_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: INGREDIENT_ID,
      kind: SHORTAGE_KIND.COVERAGE,
      hoursLeft: 2,
      remainingServiceHours: 5,
      status: LEVEL_ALERT_STATUS.OPEN,
      escalationClock: null,
    } as const;
    const dish = {
      id: "dish_burger",
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      productId: PRODUCT_ID,
      kind: SHORTAGE_KIND.DISH,
      units: 1,
      minimum: 4,
      limiterIngredientIds: [INGREDIENT_ID],
      status: LEVEL_ALERT_STATUS.OPEN,
      escalationClock: null,
    } as const;
    const notice = {
      id: "notice_admin",
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      alertId: alert.id,
      role: "siteAdministrator",
      kind: SHORTAGE_KIND.LEVEL,
      severity: LEVEL_SEVERITY.YELLOW,
      notifiedAt: OPENED_AT,
    };
    const suggestion = {
      id: "suggestion_beef",
      tenantId: TENANT_A,
      brandId: BRAND_ID,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      ingredientId: INGREDIENT_ID,
      maximum: grams(18),
      reorderPoint: grams(10),
      minimum: grams(6),
      leadTimeDays: 2,
      status: SUGGESTION_STATUS.PENDING,
    };
    const brandB = {
      tenantId: TENANT_B,
      brandId: BRAND_ID,
      ingredientId: INGREDIENT_ID,
      maximum: grams(3),
      reorderPoint: grams(2),
      minimum: grams(1),
    };

    await repository.saveBrandLevel({
      tenantId: TENANT_A,
      brandId: BRAND_ID,
      ingredientId: INGREDIENT_ID,
      ...brandLevels,
    });
    await repository.saveBrandLevel(brandB);
    await repository.saveSiteLevel({
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      ingredientId: INGREDIENT_ID,
      ...siteLevels,
    });
    await repository.saveLocationLevel({
      tenantId: TENANT_A,
      locationId: LOCATION_ID,
      ingredientId: INGREDIENT_ID,
      ...locationLevels,
    });
    await repository.saveDishLevel({
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      productId: PRODUCT_ID,
      minimum: 4,
    });
    await repository.saveCoverageSettings({
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      weeks: 4,
      marginHours: 1,
      slotMinutes: 60,
      serviceStartMinute: 11 * 60,
      serviceEndMinute: 23 * 60,
    });
    await repository.saveNotificationRule({
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      escalationMinutes: 20,
    });
    await repository.saveAlertsEnabled(TENANT_A, VENUE_ID, true);
    await repository.saveLevelAlert(alert);
    await repository.saveCoverageAlert(coverage);
    await repository.saveDishAlert(dish);
    await repository.saveRoleNotice(notice);
    await repository.saveAlertDocument({
      tenantId: TENANT_A,
      alertId: alert.id,
      documentId: "transfer_beef",
      kind: ALERT_DOCUMENT_KIND.TRANSFER,
    });
    await repository.saveSuggestion(suggestion);

    expect(
      await repository.findBrandLevel(TENANT_B, BRAND_ID, INGREDIENT_ID),
    ).toEqual(brandB);
    expect(
      await repository.findBrandLevel(TENANT_A, BRAND_ID, INGREDIENT_ID),
    ).toEqual({
      tenantId: TENANT_A,
      brandId: BRAND_ID,
      ingredientId: INGREDIENT_ID,
      ...brandLevels,
    });
    expect(
      await repository.findSiteLevel(TENANT_B, VENUE_ID, INGREDIENT_ID),
    ).toBeNull();
    expect(
      await repository.findLocationLevel(TENANT_B, LOCATION_ID, INGREDIENT_ID),
    ).toBeNull();
    expect(
      await repository.findDishLevel(TENANT_B, VENUE_ID, PRODUCT_ID),
    ).toBeNull();
    expect(
      await repository.findCoverageSettings(TENANT_B, VENUE_ID),
    ).toBeNull();
    expect(
      await repository.findNotificationRule(TENANT_B, VENUE_ID),
    ).toBeNull();
    expect(await repository.alertsEnabled(TENANT_B, VENUE_ID)).toBe(false);
    expect(
      await repository.findOpenLevelAlert(TENANT_B, LOCATION_ID, INGREDIENT_ID),
    ).toBeNull();
    expect(await repository.findLevelAlert(TENANT_B, alert.id)).toBeNull();
    expect(
      await repository.findOpenCoverageAlert(
        TENANT_B,
        LOCATION_ID,
        INGREDIENT_ID,
      ),
    ).toBeNull();
    expect(
      await repository.findOpenDishAlert(TENANT_B, VENUE_ID, PRODUCT_ID),
    ).toBeNull();
    expect(await repository.listRoleNotices(TENANT_B, alert.id)).toEqual([]);
    expect(await repository.findAlertDocument(TENANT_B, alert.id)).toBeNull();
    expect(await repository.findSuggestion(TENANT_B, suggestion.id)).toBeNull();
    expect(await repository.listOpenShortages(TENANT_B, VENUE_ID)).toEqual([]);
    expect(await repository.alertsEnabled(TENANT_A, VENUE_ID)).toBe(true);
    expect(await repository.listOpenShortages(TENANT_A, VENUE_ID)).toHaveLength(
      3,
    );
    expect(await repository.findAlertDocument(TENANT_A, alert.id)).toEqual({
      tenantId: TENANT_A,
      alertId: alert.id,
      documentId: "transfer_beef",
      kind: ALERT_DOCUMENT_KIND.TRANSFER,
    });
    expect(await repository.findSuggestion(TENANT_A, suggestion.id)).toEqual(
      suggestion,
    );
  });

  it("given a level alert saved inside a transaction, when that transaction rolls back, then the alert is not stored", async () => {
    const subject = await open();
    const kept = {
      tenantId: TENANT_A,
      brandId: BRAND_ID,
      ingredientId: INGREDIENT_ID,
      ...brandLevels,
    };
    await subject.repository.saveBrandLevel(kept);

    await expect(
      subject.inTransaction(TENANT_A, async (tx) => {
        await subject.repository.saveLevelAlert(
          levelAlert("level_beef_rollback", LEVEL_SEVERITY.YELLOW),
          tx,
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(
      await subject.repository.findBrandLevel(
        TENANT_A,
        BRAND_ID,
        INGREDIENT_ID,
      ),
    ).toEqual(kept);
    expect(
      await subject.repository.findOpenLevelAlert(
        TENANT_A,
        LOCATION_ID,
        INGREDIENT_ID,
      ),
    ).toBeNull();
    expect(
      await subject.repository.listOpenShortages(TENANT_A, VENUE_ID),
    ).toEqual([]);
  });

  it("given an open yellow alert, when the same ingredient is saved as critical, then one open row remains", async () => {
    const { repository } = await open();
    const yellow = levelAlert("level_beef_yellow", LEVEL_SEVERITY.YELLOW);
    const critical = levelAlert("level_beef_critical", LEVEL_SEVERITY.CRITICAL);

    await repository.saveLevelAlert(yellow);
    const [yellowRow] = await repository.listOpenShortages(TENANT_A, VENUE_ID);

    await repository.saveLevelAlert(critical);

    const openRows = await repository.listOpenShortages(TENANT_A, VENUE_ID);
    expect(openRows).toHaveLength(1);
    expect(yellowRow?.openedAt).not.toBe("");
    expect(openRows[0]).toMatchObject({
      kind: SHORTAGE_KIND.LEVEL,
      openedAt: yellowRow?.openedAt,
      alert: {
        id: critical.id,
        severity: LEVEL_SEVERITY.CRITICAL,
        soldOut: true,
        status: LEVEL_ALERT_STATUS.OPEN,
      },
    });
    expect(await repository.findLevelAlert(TENANT_A, yellow.id)).toBeNull();
    expect(
      await repository.findOpenLevelAlert(TENANT_A, LOCATION_ID, INGREDIENT_ID),
    ).toMatchObject({ id: critical.id, severity: LEVEL_SEVERITY.CRITICAL });
  });

  it("given no venue flag, when alerts are read, then they stay off", async () => {
    const { repository } = await open();

    expect(await repository.alertsEnabled(TENANT_A, VENUE_ID)).toBe(false);

    await repository.saveAlertsEnabled(TENANT_A, VENUE_ID, true);

    expect(await repository.alertsEnabled(TENANT_A, VENUE_ID)).toBe(true);
    expect(await repository.alertsEnabled(TENANT_B, VENUE_ID)).toBe(false);
  });
}

const testPath = (expect.getState().testPath ?? "").replaceAll("\\", "/");
const importedByPostgresContract = testPath.endsWith(
  "drizzle-shortage-repository.contract.test.ts",
);

if (!importedByPostgresContract) {
  shortageRepositoryContract(() => {
    const repository = new InMemoryShortageRepository();

    return {
      repository,
      inTransaction: (tenantId, work) =>
        repository.inTransaction(tenantId, work),
    };
  });
}
