import { DrizzleShortageRepository } from "@blackhole/inventory/adapters/postgres/drizzle-shortage-repository";
import {
  EscalateAlerts,
  type EscalateAlertsInput,
  EvaluateCoverage,
  type EvaluateCoverageInput,
  EvaluateDishAlert,
  type EvaluateDishAlertInput,
  ProposeStockLevels,
  type ProposeStockLevelsInput,
} from "@blackhole/inventory/application/entry-port";
import { Clock } from "@blackhole/platform/application/ports/clock";

export const COVERAGE_QUEUE = "inventory.evaluate-coverage";
export const DISH_ALERT_QUEUE = "inventory.evaluate-dish-alert";
export const ESCALATION_QUEUE = "inventory.escalate-alerts";
export const SUGGESTION_QUEUE = "inventory.propose-stock-levels";
export const SHORTAGE_ALERTS_CRON = "*/15 * * * *";
export const SHORTAGE_ALERTS_TIME_ZONE = "UTC";

export type ShortageDatabase = ConstructorParameters<
  typeof DrizzleShortageRepository
>[0];

type ShortageTx = Parameters<EvaluateCoverage["evaluate"]>[0];

export interface ShortageAlertBoss {
  createQueue(
    name: string,
    options?: { retryLimit?: number },
  ): Promise<void>;
  work(
    name: string,
    handler: (jobs: ReadonlyArray<{ data: object }>) => Promise<void>,
  ): Promise<void | string>;
  schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: { tz?: string },
  ): Promise<void>;
}

export interface ShortageAlertDependencies {
  alertsEnabled(tenantId: string, venueId: string): Promise<boolean>;
  inTransaction(
    tenantId: string,
    work: (tx: ShortageTx) => Promise<unknown>,
  ): Promise<unknown>;
  coverage: {
    evaluate(tx: ShortageTx, input: EvaluateCoverageInput): Promise<unknown>;
  };
  dish: {
    evaluate(
      tx: Parameters<EvaluateDishAlert["evaluate"]>[0],
      input: EvaluateDishAlertInput,
    ): Promise<unknown>;
  };
  escalation: {
    execute(input: EscalateAlertsInput): Promise<unknown>;
  };
  suggestions: {
    execute(input: ProposeStockLevelsInput): Promise<unknown>;
  };
}

class SystemUtcClock extends Clock {
  override now(): number {
    return Date.now();
  }
}

const silentAudit = {
  record: (): Promise<void> => Promise.resolve(),
};

const emptyHistory = {
  hours: (): Promise<readonly []> => Promise.resolve([]),
};

const emptyUnits = {
  atPoint: (): Promise<null> => Promise.resolve(null),
};

const read = (data: object): Record<string, unknown> =>
  data as Record<string, unknown>;

const textField = (data: object, key: string): string | null => {
  const value = read(data)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const integerField = (data: object, key: string): number | null => {
  const value = read(data)[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
};

const utcTimestamp = (clock: Clock): string =>
  new Date(clock.now()).toISOString();

const alertsAreOn = (
  dependencies: ShortageAlertDependencies,
  tenantId: string,
  venueId: string,
): Promise<boolean> => dependencies.alertsEnabled(tenantId, venueId);

const runCoverage = async (
  data: object,
  dependencies: ShortageAlertDependencies,
  clock: Clock,
): Promise<void> => {
  const tenantId = textField(data, "tenantId");
  const brandId = textField(data, "brandId");
  const venueId = textField(data, "venueId");
  const locationId = textField(data, "locationId");
  const ingredientId = textField(data, "ingredientId");

  if (!tenantId || !brandId || !venueId || !locationId || !ingredientId) {
    return;
  }

  if (!(await alertsAreOn(dependencies, tenantId, venueId))) {
    return;
  }

  const input: EvaluateCoverageInput = {
    tenantId,
    brandId,
    venueId,
    locationId,
    ingredientId,
    occurredAt: utcTimestamp(clock),
  };
  await dependencies.inTransaction(tenantId, (tx) =>
    dependencies.coverage.evaluate(tx, input),
  );
};

const runDish = async (
  data: object,
  dependencies: ShortageAlertDependencies,
  clock: Clock,
): Promise<void> => {
  const tenantId = textField(data, "tenantId");
  const venueId = textField(data, "venueId");
  const productId = textField(data, "productId");

  if (!tenantId || !venueId || !productId) {
    return;
  }

  if (!(await alertsAreOn(dependencies, tenantId, venueId))) {
    return;
  }

  const input: EvaluateDishAlertInput = {
    tenantId,
    venueId,
    productId,
    occurredAt: utcTimestamp(clock),
  };
  await dependencies.inTransaction(tenantId, (tx) =>
    dependencies.dish.evaluate(tx, input),
  );
};

const runEscalation = async (
  data: object,
  dependencies: ShortageAlertDependencies,
  clock: Clock,
): Promise<void> => {
  const tenantId = textField(data, "tenantId");
  const venueId = textField(data, "venueId");

  if (!tenantId || !venueId) {
    return;
  }

  if (!(await alertsAreOn(dependencies, tenantId, venueId))) {
    return;
  }

  await dependencies.escalation.execute({
    tenantId,
    venueId,
    now: utcTimestamp(clock),
  });
};

const runSuggestions = async (
  data: object,
  dependencies: ShortageAlertDependencies,
): Promise<void> => {
  const tenantId = textField(data, "tenantId");
  const brandId = textField(data, "brandId");
  const venueId = textField(data, "venueId");
  const locationId = textField(data, "locationId");
  const ingredientId = textField(data, "ingredientId");
  const dailyConsumption = integerField(data, "dailyConsumption");
  const leadTimeDays = integerField(data, "leadTimeDays");

  if (
    !tenantId ||
    !brandId ||
    !venueId ||
    !locationId ||
    !ingredientId ||
    dailyConsumption === null ||
    leadTimeDays === null
  ) {
    return;
  }

  if (!(await alertsAreOn(dependencies, tenantId, venueId))) {
    return;
  }

  await dependencies.suggestions.execute({
    tenantId,
    brandId,
    venueId,
    locationId,
    ingredientId,
    dailyConsumption,
    leadTimeDays,
  });
};

const registerQueue = async (
  boss: ShortageAlertBoss,
  name: string,
  run: (data: object) => Promise<void>,
): Promise<void> => {
  await boss.createQueue(name, { retryLimit: 0 });
  await boss.work(name, async (jobs) => {
    for (const job of jobs) {
      await run(job.data);
    }
  });
  await boss.schedule(name, SHORTAGE_ALERTS_CRON, {}, {
    tz: SHORTAGE_ALERTS_TIME_ZONE,
  });
};

export const disabledShortageAlerts = (): ShortageAlertDependencies => ({
  alertsEnabled: () => Promise.resolve(false),
  inTransaction: () => Promise.resolve(undefined),
  coverage: {
    evaluate: () => Promise.resolve(undefined),
  },
  dish: {
    evaluate: () => Promise.resolve(undefined),
  },
  escalation: {
    execute: () => Promise.resolve(undefined),
  },
  suggestions: {
    execute: () => Promise.resolve(undefined),
  },
});

export const shortageAlertsFromPostgres = (
  database: ShortageDatabase,
): ShortageAlertDependencies => {
  const shortages = new DrizzleShortageRepository(database);

  return {
    alertsEnabled: (tenantId, venueId) =>
      shortages.alertsEnabled(tenantId, venueId),
    inTransaction: (tenantId, work) => shortages.inTransaction(tenantId, work),
    coverage: new EvaluateCoverage(shortages, emptyHistory, silentAudit),
    dish: new EvaluateDishAlert(shortages, emptyUnits, silentAudit),
    escalation: new EscalateAlerts(shortages, silentAudit),
    suggestions: new ProposeStockLevels(shortages),
  };
};

export const registerShortageAlerts = async (
  boss: ShortageAlertBoss,
  dependencies: ShortageAlertDependencies,
  clock: Clock = new SystemUtcClock(),
): Promise<void> => {
  await registerQueue(boss, COVERAGE_QUEUE, (data) =>
    runCoverage(data, dependencies, clock),
  );
  await registerQueue(boss, DISH_ALERT_QUEUE, (data) =>
    runDish(data, dependencies, clock),
  );
  await registerQueue(boss, ESCALATION_QUEUE, (data) =>
    runEscalation(data, dependencies, clock),
  );
  await registerQueue(boss, SUGGESTION_QUEUE, (data) =>
    runSuggestions(data, dependencies),
  );
};
