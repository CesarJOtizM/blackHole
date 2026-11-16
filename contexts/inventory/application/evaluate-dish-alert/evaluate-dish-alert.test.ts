import { expect, it } from "vitest";
import {
  EvaluateDishAlert,
  type EvaluateDishAlertInput,
} from "#application/evaluate-dish-alert/evaluate-dish-alert.js";
import {
  type PointProducibleUnits,
  ProducibleUnits,
} from "#application/ports/producible-units.js";
import {
  type DishAlert,
  type DishLevel,
  LEVEL_ALERT_STATUS,
  ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import { SHORTAGE_KIND } from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const SITE_A = "organization_venue_a";
const DISH_ID = "product_star_dish";
const BEEF_ID = "ingredient_beef";
const CHEESE_ID = "ingredient_cheese";
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";
const SYSTEM_ACTOR = "system.inventory";

const command = (): EvaluateDishAlertInput => ({
  tenantId: TENANT_ID,
  venueId: SITE_A,
  productId: DISH_ID,
  occurredAt: OCCURRED_AT,
});

class MarkerTransaction implements ShortageTransaction {
  async balance(): Promise<number> {
    return 0;
  }
}

class MemoryUnits extends ProducibleUnits {
  readonly calls: Array<{
    tenantId: string;
    venueId: string;
    productId: string;
  }> = [];

  constructor(private readonly point: PointProducibleUnits | null) {
    super();
  }

  async atPoint(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<PointProducibleUnits | null> {
    this.calls.push({ tenantId, venueId, productId });
    return this.point;
  }
}

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
  readonly alertWrites: ShortageTransaction[] = [];
  private readonly flags = new Set<string>();
  private level: DishLevel | null = null;
  private readonly committed = new Map<string, DishAlert>();
  private readonly staged = new Map<
    ShortageTransaction,
    Map<string, DishAlert>
  >();

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

  putDishLevel(level: DishLevel): void {
    this.level = level;
  }

  override async alertsEnabled(
    tenantId: string,
    venueId: string,
  ): Promise<boolean> {
    return this.flags.has(`${tenantId}:${venueId}`);
  }

  override async findDishLevel(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<DishLevel | null> {
    if (
      !this.level ||
      this.level.tenantId !== tenantId ||
      this.level.venueId !== venueId ||
      this.level.productId !== productId
    ) {
      return null;
    }

    return { ...this.level };
  }

  override async findOpenDishAlert(
    tenantId: string,
    venueId: string,
    productId: string,
    tx?: ShortageTransaction,
  ): Promise<DishAlert | null> {
    const rows = tx ? this.draft(tx).values() : this.committed.values();

    for (const alert of rows) {
      if (
        alert.tenantId === tenantId &&
        alert.venueId === venueId &&
        alert.productId === productId &&
        alert.status !== LEVEL_ALERT_STATUS.RESOLVED
      ) {
        return {
          ...alert,
          limiterIngredientIds: [...alert.limiterIngredientIds],
        };
      }
    }

    return null;
  }

  override async saveDishAlert(
    alert: DishAlert,
    tx?: ShortageTransaction,
  ): Promise<void> {
    if (!tx) {
      throw new Error("A dish alert write requires the caller's transaction.");
    }

    this.alertWrites.push(tx);
    this.draft(tx).set(alert.id, {
      ...alert,
      limiterIngredientIds: [...alert.limiterIngredientIds],
    });
  }

  commit(tx: ShortageTransaction): void {
    const draft = this.staged.get(tx);

    if (!draft) {
      return;
    }

    this.committed.clear();
    for (const [id, alert] of draft) {
      this.committed.set(id, {
        ...alert,
        limiterIngredientIds: [...alert.limiterIngredientIds],
      });
    }

    this.staged.delete(tx);
  }

  committedAlerts(): DishAlert[] {
    return [...this.committed.values()].map((alert) => ({
      ...alert,
      limiterIngredientIds: [...alert.limiterIngredientIds],
    }));
  }

  private draft(tx: ShortageTransaction): Map<string, DishAlert> {
    const existing = this.staged.get(tx);

    if (existing) {
      return existing;
    }

    const copy = new Map<string, DishAlert>();

    for (const [id, alert] of this.committed) {
      copy.set(id, {
        ...alert,
        limiterIngredientIds: [...alert.limiterIngredientIds],
      });
    }

    this.staged.set(tx, copy);
    return copy;
  }
}

const limitedBy = (
  units: number,
  ingredientIds: readonly string[],
): PointProducibleUnits => ({
  units,
  limiters: ingredientIds.map((ingredientId) => ({ ingredientId })),
});

const harness = (
  point: PointProducibleUnits | null,
  minimum: number | null,
) => {
  const shortages = new MemoryShortageRepository();
  const units = new MemoryUnits(point);
  const audits = new MemoryAudit();
  const evaluate = new EvaluateDishAlert(shortages, units, audits);
  const tx = new MarkerTransaction();
  shortages.enableAlerts(TENANT_ID, SITE_A);

  if (minimum !== null) {
    shortages.putDishLevel({
      tenantId: TENANT_ID,
      venueId: SITE_A,
      productId: DISH_ID,
      minimum,
    });
  }

  return { shortages, units, audits, evaluate, tx };
};

it("given a dish minimum of 10 units, when producible units drop to 9, then the dish alert names every limiter", async () => {
  const { shortages, units, audits, evaluate, tx } = harness(
    limitedBy(9, [BEEF_ID, CHEESE_ID]),
    10,
  );

  const result = await evaluate.evaluate(tx, command());

  shortages.commit(tx);
  const [stored] = shortages.committedAlerts();
  expect(result).toEqual({ written: true, alert: stored });
  expect(stored).toMatchObject({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    productId: DISH_ID,
    kind: SHORTAGE_KIND.DISH,
    units: 9,
    minimum: 10,
    limiterIngredientIds: [BEEF_ID, CHEESE_ID],
    status: LEVEL_ALERT_STATUS.OPEN,
    escalationClock: null,
  });
  expect(stored?.limiterIngredientIds).toEqual([BEEF_ID, CHEESE_ID]);
  expect(units.calls).toEqual([
    { tenantId: TENANT_ID, venueId: SITE_A, productId: DISH_ID },
  ]);
  expect(shortages.alertWrites).toEqual([tx]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: SYSTEM_ACTOR,
      authorizerId: null,
      deviceId: SITE_A,
      siteId: SITE_A,
      action: "inventory.open-dish-alert",
      entity: stored?.id,
      before: null,
      after: stored,
      reason: "inventory.open-dish-alert",
    },
  ]);
  expect(JSON.stringify(stored)).not.toMatch(/whatsapp|sms|email|web push/i);
});

it("given producible units sit on the dish minimum, when evaluation runs, then no dish alert opens", async () => {
  const { shortages, evaluate, tx } = harness(limitedBy(10, [BEEF_ID]), 10);

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(shortages.committedAlerts()).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
});

it("given an open dish alert, when units stay below the minimum, then it is not repeated", async () => {
  const { shortages, audits, evaluate, tx } = harness(
    limitedBy(9, [BEEF_ID, CHEESE_ID]),
    10,
  );
  await evaluate.evaluate(tx, command());
  shortages.commit(tx);
  const again = new MarkerTransaction();

  const result = await evaluate.evaluate(again, command());

  shortages.commit(again);
  expect(result).toEqual({ written: false });
  expect(shortages.committedAlerts()).toHaveLength(1);
  expect(shortages.alertWrites).toHaveLength(1);
  expect(audits.commands).toHaveLength(1);
});

it("given a dish without a minimum, when its units drop, then no dish alert opens", async () => {
  const { shortages, units, evaluate, tx } = harness(
    limitedBy(9, [BEEF_ID]),
    null,
  );

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(units.calls).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
});

it("given shortage alerts are off for the venue, when units drop below the minimum, then nothing is written", async () => {
  const shortages = new MemoryShortageRepository();
  const units = new MemoryUnits(limitedBy(9, [BEEF_ID, CHEESE_ID]));
  const evaluate = new EvaluateDishAlert(shortages, units, new MemoryAudit());
  const tx = new MarkerTransaction();
  shortages.putDishLevel({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    productId: DISH_ID,
    minimum: 10,
  });

  const result = await evaluate.evaluate(tx, command());

  expect(result).toEqual({ written: false });
  expect(units.calls).toEqual([]);
  expect(shortages.alertWrites).toEqual([]);
  expect(shortages.committedAlerts()).toEqual([]);
});
