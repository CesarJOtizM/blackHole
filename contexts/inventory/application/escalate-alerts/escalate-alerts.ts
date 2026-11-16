import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  LEVEL_ALERT_STATUS,
  type OpenShortage,
  type RoleNotice,
  type ShortageRepository,
} from "#application/ports/shortage-repository.js";
import {
  ESCALATION_CLOCK,
  escalationClock,
  SHORTAGE_KIND,
} from "#domain/shortage-alert.js";

const SYSTEM_ACTOR = "system.inventory";
const ACTION = "inventory.escalate-shortage-alert";
const SITE_ADMINISTRATOR = "siteAdministrator";
const GENERAL_MANAGER = "generalManager";
const MINUTE_MS = 60_000;

export interface EscalateAlertsInput {
  tenantId: string;
  venueId: string;
  now: string;
}

const whole = (value: number): boolean => Number.isInteger(value);

const elapsedMinutes = (openedAt: string, now: string): number | null => {
  const opened = Date.parse(openedAt);
  const current = Date.parse(now);

  if (Number.isNaN(opened) || Number.isNaN(current)) {
    return null;
  }

  return (current - opened) / MINUTE_MS;
};

const dueRoles = (elapsed: number, limit: number): readonly string[] => {
  if (elapsed < limit) {
    return [];
  }

  if (elapsed < limit * 2) {
    return [SITE_ADMINISTRATOR];
  }

  return [SITE_ADMINISTRATOR, GENERAL_MANAGER];
};

const clockOf = (row: OpenShortage) => {
  if (row.kind !== SHORTAGE_KIND.LEVEL) {
    return escalationClock(row.kind);
  }

  return escalationClock(SHORTAGE_KIND.LEVEL, row.alert.severity);
};

export class EscalateAlerts {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly audits: ShortageAudit,
  ) {}

  async execute(input: EscalateAlertsInput): Promise<RoleNotice[]> {
    const enabled = await this.shortages.alertsEnabled(
      input.tenantId,
      input.venueId,
    );

    if (!enabled) {
      return [];
    }

    const rule = await this.shortages.findNotificationRule(
      input.tenantId,
      input.venueId,
    );

    if (
      !rule ||
      rule.escalationMinutes === null ||
      !whole(rule.escalationMinutes) ||
      rule.escalationMinutes < 1
    ) {
      return [];
    }

    const open = await this.shortages.listOpenShortages(
      input.tenantId,
      input.venueId,
    );
    const created: RoleNotice[] = [];

    for (const row of open) {
      if (row.alert.status !== LEVEL_ALERT_STATUS.OPEN) {
        continue;
      }

      if (clockOf(row) !== ESCALATION_CLOCK.RED) {
        continue;
      }

      const elapsed = elapsedMinutes(row.openedAt, input.now);

      if (elapsed === null) {
        continue;
      }

      const existing = await this.shortages.listRoleNotices(
        input.tenantId,
        row.alert.id,
      );
      const notified = new Set(existing.map((notice) => notice.role));

      for (const role of dueRoles(elapsed, rule.escalationMinutes)) {
        if (notified.has(role)) {
          continue;
        }

        const notice: RoleNotice = {
          id: `notice:${row.alert.id}:${role}`,
          tenantId: input.tenantId,
          venueId: input.venueId,
          alertId: row.alert.id,
          role,
          kind: row.alert.kind,
          severity:
            row.kind === SHORTAGE_KIND.LEVEL ? row.alert.severity : null,
          notifiedAt: input.now,
        };
        await this.shortages.saveRoleNotice(notice);
        await this.audits.record({
          tenantId: input.tenantId,
          actorId: SYSTEM_ACTOR,
          authorizerId: null,
          deviceId: input.venueId,
          siteId: input.venueId,
          action: ACTION,
          entity: notice.id,
          before: null,
          after: notice,
          reason: ACTION,
        });
        notified.add(role);
        created.push(notice);
      }
    }

    return created;
  }
}
