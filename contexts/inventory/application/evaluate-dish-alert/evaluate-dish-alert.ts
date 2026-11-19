import type { ProducibleUnits } from "#application/ports/producible-units.js";
import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  type DishAlert,
  LEVEL_ALERT_STATUS,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import { SHORTAGE_KIND } from "#domain/shortage-alert.js";

const SYSTEM_ACTOR = "system.inventory";
const OPEN_ACTION = "inventory.open-dish-alert";

export interface EvaluateDishAlertInput {
  tenantId: string;
  venueId: string;
  productId: string;
  occurredAt: string;
}

export type DishEvaluation =
  | { readonly written: false }
  | { readonly written: true; readonly alert: DishAlert };

export class EvaluateDishAlert {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly units: ProducibleUnits,
    private readonly audits: ShortageAudit,
  ) {}

  async evaluate(
    tx: ShortageTransaction,
    input: EvaluateDishAlertInput,
  ): Promise<DishEvaluation> {
    const enabled = await this.shortages.alertsEnabled(
      input.tenantId,
      input.venueId,
      tx,
    );

    if (!enabled) {
      return { written: false };
    }

    const level = await this.shortages.findDishLevel(
      input.tenantId,
      input.venueId,
      input.productId,
      tx,
    );

    if (!level) {
      return { written: false };
    }

    const point = await this.units.atPoint(
      input.tenantId,
      input.venueId,
      input.productId,
    );

    if (!point || point.units >= level.minimum) {
      return { written: false };
    }

    const open = await this.shortages.findOpenDishAlert(
      input.tenantId,
      input.venueId,
      input.productId,
      tx,
    );

    if (open) {
      return { written: false };
    }

    const alert: DishAlert = {
      id: `dish:${input.tenantId}:${input.venueId}:${input.productId}`,
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
      kind: SHORTAGE_KIND.DISH,
      units: point.units,
      minimum: level.minimum,
      limiterIngredientIds: point.limiters.map(
        (limiter) => limiter.ingredientId,
      ),
      status: LEVEL_ALERT_STATUS.OPEN,
      escalationClock: null,
    };
    await this.shortages.saveDishAlert(alert, tx);
    await this.audits.record({
      tenantId: input.tenantId,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: OPEN_ACTION,
      entity: alert.id,
      before: null,
      after: alert,
      reason: OPEN_ACTION,
    });

    return { written: true, alert };
  }
}
