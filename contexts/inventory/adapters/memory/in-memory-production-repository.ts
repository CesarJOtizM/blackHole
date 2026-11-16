import type {
  AppendProduction,
  AppendProductionCompensation,
  ProductionCostPolicy,
  ProductionStockLine,
  RecordedProductionRun,
  SaveProductionCostPolicy,
} from "#application/ports/production-repository.js";
import { ProductionRepository } from "#application/ports/production-repository.js";
import type { ProductionCostRule } from "#domain/production.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const INSERT_FAILED = "The production output insert failed.";

export interface ProductionOutboxRow {
  lane: "after_sales";
  tenantId: string;
  runId: string;
}

interface Holding {
  quantity: number;
  averageCost: number;
}

interface StoredPolicy {
  costRule: ProductionCostRule;
  preparations: Map<string, number>;
}

type StoredMovement = ProductionStockLine & { reversesMovementId?: string };

interface Snapshot {
  runs: Map<string, RecordedProductionRun>;
  compensations: Map<string, AppendProductionCompensation>;
  holdings: Map<string, Holding>;
  alerts: Set<string>;
  policies: Map<string, StoredPolicy>;
  movements: StoredMovement[];
}

const runKey = (tenantId: string, runId: string): string =>
  `${tenantId}\u0000${runId}`;

const holdingKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const alertKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const copyMovement = (movement: StoredMovement): StoredMovement => ({
  ...movement,
});

const copyRun = (run: RecordedProductionRun): RecordedProductionRun => ({
  ...run,
  movements: run.movements.map((movement) => ({ ...movement })),
});

const copyCompensation = (
  compensation: AppendProductionCompensation,
): AppendProductionCompensation => ({
  ...compensation,
  movements: compensation.movements.map((movement) => ({ ...movement })),
});

const copyPolicy = (policy: StoredPolicy): StoredPolicy => ({
  costRule: policy.costRule,
  preparations: new Map(policy.preparations),
});

export class InMemoryProductionRepository extends ProductionRepository {
  private readonly runs = new Map<string, RecordedProductionRun>();
  private readonly compensations = new Map<
    string,
    AppendProductionCompensation
  >();
  private readonly holdings = new Map<string, Holding>();
  private readonly alerts = new Set<string>();
  private readonly policies = new Map<string, StoredPolicy>();
  private movements: StoredMovement[] = [];
  private failAt: number | null = null;

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  seedHolding(input: {
    tenantId: string;
    locationId: string;
    ingredientId: string;
    quantity: number;
    averageCost: number;
  }): Promise<void> {
    this.holdings.set(
      holdingKey(input.tenantId, input.locationId, input.ingredientId),
      {
        quantity: input.quantity,
        averageCost: input.averageCost,
      },
    );
    return Promise.resolve();
  }

  productionMovements(tenantId: string): readonly StoredMovement[] {
    return this.movements
      .filter((movement) => movement.tenantId === tenantId)
      .map(copyMovement);
  }

  // Production never joins the sale drain. The lane stays empty.
  afterSales(tenantId: string): readonly ProductionOutboxRow[] {
    void tenantId;
    return [];
  }

  override async findRun(
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null> {
    const found = this.runs.get(runKey(tenantId, runId));
    return found ? copyRun(found) : null;
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.holding(tenantId, locationId, ingredientId).quantity;
  }

  override async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.holding(tenantId, locationId, ingredientId).averageCost;
  }

  override async hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean> {
    return this.alerts.has(alertKey(tenantId, locationId, ingredientId));
  }

  override async policyFor(
    tenantId: string,
    recipeId: string,
  ): Promise<ProductionCostPolicy | null> {
    const policy = this.policies.get(tenantId);

    if (!policy) {
      return null;
    }

    return {
      costRule: policy.costRule,
      standardUnitCost: policy.preparations.get(recipeId) ?? null,
    };
  }

  override async append(input: AppendProduction): Promise<void> {
    const failAt = this.failAt;
    this.failAt = null;
    const key = runKey(input.run.tenantId, input.run.runId);

    if (this.runs.has(key)) {
      return;
    }

    const snapshot = this.capture();

    try {
      for (const [index, movement] of input.run.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(INSERT_FAILED);
        }

        this.apply(movement);
        this.movements.push(copyMovement(movement));
      }

      for (const alert of input.alerts) {
        this.alerts.add(
          alertKey(alert.tenantId, alert.locationId, alert.ingredientId),
        );
      }

      this.runs.set(key, copyRun(input.run));
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  override async findCompensation(
    tenantId: string,
    originalRunId: string,
  ): Promise<AppendProductionCompensation | null> {
    const found = this.compensations.get(runKey(tenantId, originalRunId));
    return found ? copyCompensation(found) : null;
  }

  override async appendCompensation(
    input: AppendProductionCompensation,
  ): Promise<void> {
    const key = runKey(input.tenantId, input.originalRunId);

    if (this.compensations.has(key)) {
      throw new Error(
        `Production compensation is already stored for ${input.originalRunId}.`,
      );
    }

    const snapshot = this.capture();

    try {
      for (const movement of input.movements) {
        this.apply(movement);
        this.movements.push(copyMovement(movement));
      }

      this.compensations.set(key, copyCompensation(input));
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  override async saveCostPolicy(
    input: SaveProductionCostPolicy,
  ): Promise<void> {
    this.policies.set(input.tenantId, {
      costRule: input.costRule,
      preparations: new Map(
        input.preparations.map((preparation) => [
          preparation.recipeId,
          preparation.standardUnitCost,
        ]),
      ),
    });
  }

  private holding(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Holding {
    return (
      this.holdings.get(holdingKey(tenantId, locationId, ingredientId)) ?? {
        quantity: 0,
        averageCost: 0,
      }
    );
  }

  private apply(movement: StoredMovement): void {
    const key = holdingKey(
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    const current = this.holding(
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    const averageCost =
      movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT && movement.quantity > 0
        ? nextAverageCost({
            onHand: current.quantity,
            averageCost: current.averageCost,
            receivedQuantity: movement.quantity,
            receiptCost: movement.unitCost,
          })
        : current.averageCost;

    this.holdings.set(key, {
      quantity: current.quantity + movement.quantity,
      averageCost,
    });
  }

  private capture(): Snapshot {
    return {
      runs: new Map([...this.runs].map(([key, run]) => [key, copyRun(run)])),
      compensations: new Map(
        [...this.compensations].map(([key, stored]) => [
          key,
          copyCompensation(stored),
        ]),
      ),
      holdings: new Map(
        [...this.holdings].map(([key, holding]) => [key, { ...holding }]),
      ),
      alerts: new Set(this.alerts),
      policies: new Map(
        [...this.policies].map(([key, policy]) => [key, copyPolicy(policy)]),
      ),
      movements: this.movements.map(copyMovement),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.runs.clear();
    this.compensations.clear();
    this.holdings.clear();
    this.alerts.clear();
    this.policies.clear();

    for (const [key, run] of snapshot.runs) {
      this.runs.set(key, run);
    }

    for (const [key, stored] of snapshot.compensations) {
      this.compensations.set(key, stored);
    }

    for (const [key, holding] of snapshot.holdings) {
      this.holdings.set(key, holding);
    }

    for (const alert of snapshot.alerts) {
      this.alerts.add(alert);
    }

    for (const [key, policy] of snapshot.policies) {
      this.policies.set(key, policy);
    }

    this.movements = snapshot.movements;
  }
}
