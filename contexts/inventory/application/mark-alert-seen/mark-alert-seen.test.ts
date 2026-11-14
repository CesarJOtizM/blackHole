import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { MarkAlertSeen } from "#application/mark-alert-seen/mark-alert-seen.js";
import { PlatformShortageAudit } from "#application/ports/shortage-audit.js";
import {
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import {
  ESCALATION_CLOCK,
  LEVEL_SEVERITY,
  SHORTAGE_KIND,
} from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const BEEF_ID = "ingredient_beef";
const ALERT_ID =
  "level:organization_tenant_1:inventory_location_a:ingredient_beef";
const ACTOR_ID = "user_kitchen_chief";
const SEEN_AT = "2026-11-13T18:04:00.000Z";

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
  async balance(): Promise<number> {
    return 0;
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

  seed(alert: LevelAlert): void {
    this.alerts.set(alert.id, { ...alert });
  }

  async saveBrandLevel(): Promise<void> {}

  async saveSiteLevel(): Promise<void> {}

  async findBrandLevel(): Promise<null> {
    return null;
  }

  async findSiteLevel(): Promise<null> {
    return null;
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

const harness = () => {
  const shortages = new MemoryShortageRepository();
  const events = new CapturedAudit();
  const seen = new MarkAlertSeen(shortages, new PlatformShortageAudit(events));

  return { shortages, events, seen, tx: new ScriptedBalance() };
};

it("given an open beef alert, when the kitchen chief marks it seen, then who and when are recorded", async () => {
  const { shortages, events, seen, tx } = harness();
  const alert = openAlert();
  shortages.seed(alert);

  const result = await seen.execute(tx, {
    tenantId: TENANT_ID,
    venueId: SITE_A,
    alertId: ALERT_ID,
    actorId: ACTOR_ID,
    seenAt: SEEN_AT,
  });

  const marked = {
    ...alert,
    status: LEVEL_ALERT_STATUS.SEEN,
    seenBy: ACTOR_ID,
    seenAt: SEEN_AT,
  };
  expect(result).toEqual(marked);
  expect(shortages.saved).toEqual([marked]);
  expect(events.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.mark-alert-seen",
      entity: ALERT_ID,
      before: alert,
      after: marked,
      reason: "inventory.mark-alert-seen",
    },
  ]);
});
