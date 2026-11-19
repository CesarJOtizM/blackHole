import { expect, it } from "vitest";
import {
  EscalateAlerts,
  type EscalateAlertsInput,
} from "#application/escalate-alerts/escalate-alerts.js";
import {
  type CoverageAlert,
  type DishAlert,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type NotificationRule,
  type OpenShortage,
  type RoleNotice,
  ShortageRepository,
} from "#application/ports/shortage-repository.js";
import {
  ESCALATION_CLOCK,
  escalationClock,
  LEVEL_SEVERITY,
  type LevelSeverity,
  SHORTAGE_KIND,
} from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const OPENED_AT = "2026-11-13T18:00:00.000Z";
const PAST_LIMIT = "2026-11-13T18:21:00.000Z";
const INSIDE_LIMIT = "2026-11-13T18:10:00.000Z";
const SECOND_STEP = "2026-11-13T18:40:00.000Z";
const SYSTEM_ACTOR = "system.inventory";
const SITE_ADMINISTRATOR = "siteAdministrator";
const GENERAL_MANAGER = "generalManager";

const command = (now: string): EscalateAlertsInput => ({
  tenantId: TENANT_ID,
  venueId: SITE_A,
  now,
});

const levelAlert = (
  id: string,
  severity: LevelSeverity,
  status: LevelAlert["status"] = LEVEL_ALERT_STATUS.OPEN,
): LevelAlert => ({
  id,
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: id,
  kind: SHORTAGE_KIND.LEVEL,
  severity,
  soldOut: severity === LEVEL_SEVERITY.CRITICAL,
  status,
  escalationClock: escalationClock(SHORTAGE_KIND.LEVEL, severity) ?? null,
  seenBy: status === LEVEL_ALERT_STATUS.SEEN ? "user_kitchen_chief" : null,
  seenAt: status === LEVEL_ALERT_STATUS.SEEN ? OPENED_AT : null,
  resolvedBy: null,
  resolvedAt: null,
  reason: null,
});

const coverageAlert = (): CoverageAlert => ({
  id: "coverage:beef",
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: "ingredient_beef",
  kind: SHORTAGE_KIND.COVERAGE,
  hoursLeft: 3,
  remainingServiceHours: 5,
  status: LEVEL_ALERT_STATUS.OPEN,
  escalationClock: null,
});

const dishAlert = (): DishAlert => ({
  id: "dish:star",
  tenantId: TENANT_ID,
  venueId: SITE_A,
  productId: "product_star_dish",
  kind: SHORTAGE_KIND.DISH,
  units: 9,
  minimum: 10,
  limiterIngredientIds: ["ingredient_beef"],
  status: LEVEL_ALERT_STATUS.OPEN,
  escalationClock: null,
});

const opened = (
  alert: LevelAlert | CoverageAlert | DishAlert,
): OpenShortage => {
  if (alert.kind === SHORTAGE_KIND.LEVEL) {
    return { kind: SHORTAGE_KIND.LEVEL, alert, openedAt: OPENED_AT };
  }

  if (alert.kind === SHORTAGE_KIND.COVERAGE) {
    return { kind: SHORTAGE_KIND.COVERAGE, alert, openedAt: OPENED_AT };
  }

  return { kind: SHORTAGE_KIND.DISH, alert, openedAt: OPENED_AT };
};

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

  async record(entry: MemoryAudit["commands"][number]): Promise<void> {
    this.commands.push(entry);
  }
}

class MemoryShortageRepository extends ShortageRepository {
  readonly openReads: string[] = [];
  private readonly flags = new Set<string>();
  private rule: NotificationRule | null = null;
  private readonly open: OpenShortage[] = [];
  private readonly notices: RoleNotice[] = [];

  async saveBrandLevel(): Promise<void> {
    return undefined;
  }

  async saveSiteLevel(): Promise<void> {
    return undefined;
  }

  async findBrandLevel(): Promise<null> {
    return null;
  }

  async findSiteLevel(): Promise<null> {
    return null;
  }

  enableAlerts(tenantId: string, venueId: string): void {
    this.flags.add(`${tenantId}:${venueId}`);
  }

  putRule(rule: NotificationRule): void {
    this.rule = rule;
  }

  putOpen(row: OpenShortage): void {
    this.open.push(row);
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.flags.has(`${tenantId}:${venueId}`);
  }

  override async findNotificationRule(
    tenantId: string,
    venueId: string,
  ): Promise<NotificationRule | null> {
    if (
      !this.rule ||
      this.rule.tenantId !== tenantId ||
      this.rule.venueId !== venueId
    ) {
      return null;
    }

    return { ...this.rule };
  }

  override async listOpenShortages(
    tenantId: string,
    venueId: string,
  ): Promise<OpenShortage[]> {
    this.openReads.push(`${tenantId}:${venueId}`);
    return this.open
      .filter(
        (row) =>
          row.alert.tenantId === tenantId && row.alert.venueId === venueId,
      )
      .map((row): OpenShortage => ({ ...row }));
  }

  override async listRoleNotices(
    tenantId: string,
    alertId: string,
  ): Promise<RoleNotice[]> {
    return this.notices
      .filter(
        (notice) => notice.tenantId === tenantId && notice.alertId === alertId,
      )
      .map((notice) => ({ ...notice }));
  }

  override async saveRoleNotice(notice: RoleNotice): Promise<void> {
    this.notices.push({ ...notice });
  }

  savedNotices(): RoleNotice[] {
    return this.notices.map((notice) => ({ ...notice }));
  }
}

const harness = (
  rows: readonly OpenShortage[],
  escalationMinutes: number | null = 20,
) => {
  const shortages = new MemoryShortageRepository();
  const audits = new MemoryAudit();
  const escalate = new EscalateAlerts(shortages, audits);
  shortages.enableAlerts(TENANT_ID, SITE_A);
  shortages.putRule({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    escalationMinutes,
  });

  for (const row of rows) {
    shortages.putOpen(row);
  }

  return { shortages, audits, escalate };
};

it("given a red alert and a critical alert unseen past 20 minutes, when escalation runs, then each role gets one notice and yellow and coverage do not", async () => {
  const red = levelAlert("level:red", LEVEL_SEVERITY.RED);
  const critical = levelAlert("level:critical", LEVEL_SEVERITY.CRITICAL);
  const { shortages, audits, escalate } = harness([
    opened(red),
    opened(critical),
    opened(levelAlert("level:yellow", LEVEL_SEVERITY.YELLOW)),
    opened(coverageAlert()),
    opened(dishAlert()),
  ]);

  const created = await escalate.execute(command(PAST_LIMIT));

  const notices = shortages.savedNotices();
  expect(created).toEqual(notices);
  expect(notices).toHaveLength(2);
  expect(notices.map((notice) => notice.role)).toEqual([
    SITE_ADMINISTRATOR,
    SITE_ADMINISTRATOR,
  ]);
  expect(notices.map((notice) => notice.alertId)).toEqual([
    red.id,
    critical.id,
  ]);
  expect(notices.every((notice) => notice.kind === SHORTAGE_KIND.LEVEL)).toBe(
    true,
  );
  expect(critical.escalationClock).toBe(ESCALATION_CLOCK.RED);
  expect(red.escalationClock).toBe(ESCALATION_CLOCK.RED);
  expect(Object.values(ESCALATION_CLOCK)).toEqual([ESCALATION_CLOCK.RED]);
  expect(audits.commands).toEqual(
    notices.map((notice) => ({
      tenantId: TENANT_ID,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.escalate-shortage-alert",
      entity: notice.id,
      before: null,
      after: notice,
      reason: "inventory.escalate-shortage-alert",
    })),
  );
  expect(JSON.stringify(notices)).not.toMatch(
    /whatsapp|sms|email|web push|webpush/i,
  );

  const again = await escalate.execute(command(PAST_LIMIT));

  expect(again).toEqual([]);
  expect(shortages.savedNotices()).toHaveLength(2);
  expect(audits.commands).toHaveLength(2);
});

it("given a red alert unseen for 10 minutes, when escalation runs, then nobody is notified", async () => {
  const { shortages, audits, escalate } = harness([
    opened(levelAlert("level:red", LEVEL_SEVERITY.RED)),
  ]);

  const created = await escalate.execute(command(INSIDE_LIMIT));

  expect(created).toEqual([]);
  expect(shortages.savedNotices()).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given a red alert unseen for 40 minutes, when escalation runs twice, then the administrator and the manager each have one notice", async () => {
  const { shortages, escalate } = harness([
    opened(levelAlert("level:red", LEVEL_SEVERITY.RED)),
  ]);

  await escalate.execute(command(SECOND_STEP));
  await escalate.execute(command(SECOND_STEP));

  const notices = shortages.savedNotices();
  expect(notices.map((notice) => notice.role)).toEqual([
    SITE_ADMINISTRATOR,
    GENERAL_MANAGER,
  ]);
  expect(new Set(notices.map((notice) => notice.role)).size).toBe(
    notices.length,
  );
});

it("given a seen red alert past the limit, when escalation runs, then nobody is notified", async () => {
  const { shortages, escalate } = harness([
    opened(
      levelAlert("level:red", LEVEL_SEVERITY.RED, LEVEL_ALERT_STATUS.SEEN),
    ),
  ]);

  const created = await escalate.execute(command(PAST_LIMIT));

  expect(created).toEqual([]);
  expect(shortages.savedNotices()).toEqual([]);
});

it("given the venue has not stored an escalation limit, when a red alert is old, then no number is assumed and nobody is notified", async () => {
  const { shortages, escalate } = harness(
    [opened(levelAlert("level:red", LEVEL_SEVERITY.RED))],
    null,
  );

  const created = await escalate.execute(command(PAST_LIMIT));

  expect(created).toEqual([]);
  expect(shortages.savedNotices()).toEqual([]);
});

it("given shortage alerts are off for the venue, when a red alert is past the limit, then nothing is written", async () => {
  const shortages = new MemoryShortageRepository();
  const escalate = new EscalateAlerts(shortages, new MemoryAudit());
  shortages.putRule({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    escalationMinutes: 20,
  });
  shortages.putOpen(opened(levelAlert("level:red", LEVEL_SEVERITY.RED)));

  const created = await escalate.execute(command(PAST_LIMIT));

  expect(created).toEqual([]);
  expect(shortages.openReads).toEqual([]);
  expect(shortages.savedNotices()).toEqual([]);
});
