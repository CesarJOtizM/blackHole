import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import {
  escalationClock,
  evaluateLevel,
  LEVEL_ACTION,
  type LevelSeverity,
  SHORTAGE_KIND,
} from "#domain/shortage-alert.js";

const SYSTEM_ACTOR = "system.inventory";
const OPEN_ACTION = "inventory.open-shortage-alert";
const RAISE_ACTION = "inventory.raise-shortage-alert";
const RESOLVE_ACTION = "inventory.resolve-shortage-alert";
const AUTO_RESOLVE_REASON = "stock above reorder point";

export interface EvaluateStockLevelsInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  occurredAt: string;
}

export type StockLevelEvaluation =
  | { readonly written: false }
  | {
      readonly written: true;
      readonly action: "open" | "raise" | "resolve";
      readonly alert: LevelAlert;
    };

export class EvaluateStockLevels {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly audits: ShortageAudit,
  ) {}

  async evaluate(
    tx: ShortageTransaction,
    input: EvaluateStockLevelsInput,
  ): Promise<StockLevelEvaluation> {
    const enabled = await this.shortages.alertsEnabled(
      input.tenantId,
      input.venueId,
      tx,
    );

    if (!enabled) {
      return { written: false };
    }

    const levels = await this.shortages.effectiveLevels(
      {
        tenantId: input.tenantId,
        brandId: input.brandId,
        venueId: input.venueId,
        locationId: input.locationId,
        ingredientId: input.ingredientId,
      },
      tx,
    );

    if (!levels) {
      return { written: false };
    }

    const onHand = await tx.balance(
      input.tenantId,
      input.locationId,
      input.ingredientId,
    );
    const open = await this.shortages.findOpenLevelAlert(
      input.tenantId,
      input.locationId,
      input.ingredientId,
      tx,
    );
    const decision = evaluateLevel({
      onHand,
      levels,
      openSeverity: open?.severity,
    });

    if (decision.action === LEVEL_ACTION.OPEN) {
      return this.write(tx, input, open, decision.severity, decision.soldOut);
    }

    if (decision.action === LEVEL_ACTION.RAISE) {
      return this.write(tx, input, open, decision.severity, decision.soldOut);
    }

    if (decision.action === LEVEL_ACTION.RESOLVE && open) {
      const resolved: LevelAlert = {
        ...open,
        status: LEVEL_ALERT_STATUS.RESOLVED,
        reason: AUTO_RESOLVE_REASON,
        resolvedBy: SYSTEM_ACTOR,
        resolvedAt: input.occurredAt,
      };
      await this.shortages.saveLevelAlert(resolved, tx);
      await this.audits.record(
        this.command(
          input,
          RESOLVE_ACTION,
          open,
          resolved,
          AUTO_RESOLVE_REASON,
        ),
      );

      return { written: true, action: "resolve", alert: resolved };
    }

    return { written: false };
  }

  private async write(
    tx: ShortageTransaction,
    input: EvaluateStockLevelsInput,
    open: LevelAlert | null,
    severity: LevelSeverity,
    soldOut: boolean,
  ): Promise<StockLevelEvaluation> {
    const clock = escalationClock(SHORTAGE_KIND.LEVEL, severity) ?? null;
    const next: LevelAlert = open
      ? { ...open, severity, soldOut, escalationClock: clock }
      : {
          id: `level:${input.tenantId}:${input.locationId}:${input.ingredientId}`,
          tenantId: input.tenantId,
          brandId: input.brandId,
          venueId: input.venueId,
          locationId: input.locationId,
          ingredientId: input.ingredientId,
          kind: SHORTAGE_KIND.LEVEL,
          severity,
          soldOut,
          status: LEVEL_ALERT_STATUS.OPEN,
          escalationClock: clock,
          seenBy: null,
          seenAt: null,
          resolvedBy: null,
          resolvedAt: null,
          reason: null,
        };
    const action = open ? RAISE_ACTION : OPEN_ACTION;
    await this.shortages.saveLevelAlert(next, tx);
    await this.audits.record(this.command(input, action, open, next, action));

    return {
      written: true,
      action: open ? "raise" : "open",
      alert: next,
    };
  }

  private command(
    input: EvaluateStockLevelsInput,
    action: string,
    before: LevelAlert | null,
    after: LevelAlert,
    reason: string,
  ) {
    return {
      tenantId: input.tenantId,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action,
      entity: after.id,
      before,
      after,
      reason,
    };
  }
}
