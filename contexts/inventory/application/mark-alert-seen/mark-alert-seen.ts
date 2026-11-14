import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";

const ACTION = "inventory.mark-alert-seen";

export class ShortageAlertNotFound extends Error {
  constructor() {
    super("Shortage alert was not found.");
    this.name = "ShortageAlertNotFound";
  }
}

export interface MarkAlertSeenInput {
  tenantId: string;
  venueId: string;
  alertId: string;
  actorId: string;
  seenAt: string;
}

export class MarkAlertSeen {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly audits: ShortageAudit,
  ) {}

  async execute(
    tx: ShortageTransaction,
    input: MarkAlertSeenInput,
  ): Promise<LevelAlert> {
    const alert = await this.shortages.findLevelAlert(
      input.tenantId,
      input.alertId,
      tx,
    );

    if (!alert || alert.status === LEVEL_ALERT_STATUS.RESOLVED) {
      throw new ShortageAlertNotFound();
    }

    const seen: LevelAlert = {
      ...alert,
      status: LEVEL_ALERT_STATUS.SEEN,
      seenBy: input.actorId,
      seenAt: input.seenAt,
    };
    await this.shortages.saveLevelAlert(seen, tx);
    await this.audits.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: ACTION,
      entity: alert.id,
      before: alert,
      after: seen,
      reason: ACTION,
    });

    return seen;
  }
}
