import { ShortageAlertNotFound } from "#application/mark-alert-seen/mark-alert-seen.js";
import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";

const ACTION = "inventory.resolve-shortage-alert";

export class ResolveReasonRequired extends Error {
  constructor() {
    super("Resolving a shortage alert requires a reason.");
    this.name = "ResolveReasonRequired";
  }
}

export { ShortageAlertNotFound };

export interface ResolveAlertInput {
  tenantId: string;
  venueId: string;
  alertId: string;
  actorId: string;
  resolvedAt: string;
  reason: string;
}

export class ResolveAlert {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly audits: ShortageAudit,
  ) {}

  async execute(
    tx: ShortageTransaction,
    input: ResolveAlertInput,
  ): Promise<LevelAlert> {
    const reason = input.reason.trim();

    if (reason === "") {
      throw new ResolveReasonRequired();
    }

    const alert = await this.shortages.findLevelAlert(
      input.tenantId,
      input.alertId,
      tx,
    );

    if (!alert || alert.status === LEVEL_ALERT_STATUS.RESOLVED) {
      throw new ShortageAlertNotFound();
    }

    const levels = await this.shortages.effectiveLevels(
      {
        tenantId: alert.tenantId,
        brandId: alert.brandId,
        venueId: alert.venueId,
        locationId: alert.locationId,
        ingredientId: alert.ingredientId,
      },
      tx,
    );
    const onHand = await tx.balance(
      alert.tenantId,
      alert.locationId,
      alert.ingredientId,
    );

    if (!levels || onHand <= levels.reorderPoint) {
      return alert;
    }

    const resolved: LevelAlert = {
      ...alert,
      status: LEVEL_ALERT_STATUS.RESOLVED,
      reason,
      resolvedBy: input.actorId,
      resolvedAt: input.resolvedAt,
    };
    await this.shortages.saveLevelAlert(resolved, tx);
    await this.audits.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: ACTION,
      entity: alert.id,
      before: alert,
      after: resolved,
      reason,
    });

    return resolved;
  }
}
