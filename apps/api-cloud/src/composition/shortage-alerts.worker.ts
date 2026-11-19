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
  createQueue(name: string, options?: { retryLimit?: number }): Promise<void>;
  work(
    name: string,
    handler: (jobs: ReadonlyArray<{ data: object }>) => Promise<void>,
  ): Promise<undefined | string>;
  schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: { tz?: string },
  ): Promise<void>;
}

export interface ShortageVenueTick {
  tenantId: string;
  venueId: string;
  brandId?: string;
  locationId?: string;
  ingredientId?: string;
  productId?: string;
  dailyConsumption?: number;
  leadTimeDays?: number;
}

export interface ShortageAlertDependencies {
  enabledVenues(): Promise<readonly ShortageVenueTick[]>;
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

const runExpanded = async (
  data: object,
  dependencies: ShortageAlertDependencies,
  run: (payload: object) => Promise<void>,
): Promise<void> => {
  if (textField(data, "tenantId")) {
    await run(data);
    return;
  }

  for (const venue of await dependencies.enabledVenues()) {
    await run(venue);
  }
};

const registerQueue = async (
  boss: ShortageAlertBoss,
  name: string,
  dependencies: ShortageAlertDependencies,
  run: (data: object) => Promise<void>,
): Promise<void> => {
  await boss.createQueue(name, { retryLimit: 0 });
  await boss.work(name, async (jobs) => {
    for (const job of jobs) {
      await runExpanded(job.data, dependencies, run);
    }
  });
  await boss.schedule(
    name,
    SHORTAGE_ALERTS_CRON,
    {},
    {
      tz: SHORTAGE_ALERTS_TIME_ZONE,
    },
  );
};

interface EnabledVenueRow extends Record<string, unknown> {
  tenant_id: string;
  venue_id: string;
  brand_id: string | null;
  location_id: string | null;
  ingredient_id: string | null;
  product_id: string | null;
}

const ENABLED_VENUES = `
SELECT rules.tenant_id,
       rules.venue_id,
       templates.brand_id,
       levels.scope_id AS location_id,
       levels.ingredient_id,
       dishes.product_id
FROM notification_rules AS rules
LEFT JOIN LATERAL (
  SELECT brand_id
  FROM stock_level_templates
  WHERE tenant_id = rules.tenant_id
  ORDER BY brand_id
  LIMIT 1
) AS templates ON true
LEFT JOIN LATERAL (
  SELECT scope_id, ingredient_id
  FROM stock_levels
  WHERE tenant_id = rules.tenant_id
    AND scope = 'location'
  ORDER BY scope_id, ingredient_id
  LIMIT 1
) AS levels ON true
LEFT JOIN LATERAL (
  SELECT product_id
  FROM dish_levels
  WHERE tenant_id = rules.tenant_id
    AND venue_id = rules.venue_id
  ORDER BY product_id
  LIMIT 1
) AS dishes ON true
WHERE rules.shortage_alerts_enabled = true
ORDER BY rules.tenant_id, rules.venue_id
`;

const textOrOmit = (value: string | null): string | undefined =>
  value && value.length > 0 ? value : undefined;

const listEnabledVenues = async (
  database: ShortageDatabase,
): Promise<readonly ShortageVenueTick[]> => {
  try {
    const selected = await database.query<EnabledVenueRow>(ENABLED_VENUES);

    return selected.rows.map((row) => ({
      tenantId: row.tenant_id,
      venueId: row.venue_id,
      ...(textOrOmit(row.brand_id) === undefined
        ? {}
        : { brandId: row.brand_id ?? undefined }),
      ...(textOrOmit(row.location_id) === undefined
        ? {}
        : { locationId: row.location_id ?? undefined }),
      ...(textOrOmit(row.ingredient_id) === undefined
        ? {}
        : { ingredientId: row.ingredient_id ?? undefined }),
      ...(textOrOmit(row.product_id) === undefined
        ? {}
        : { productId: row.product_id ?? undefined }),
    }));
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes("notification_rules") ||
        error.message.includes("stock_level"))
    ) {
      return [];
    }

    throw error;
  }
};

export const disabledShortageAlerts = (): ShortageAlertDependencies => ({
  enabledVenues: () => Promise.resolve([]),
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
    enabledVenues: () => listEnabledVenues(database),
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
  await registerQueue(boss, COVERAGE_QUEUE, dependencies, (data) =>
    runCoverage(data, dependencies, clock),
  );
  await registerQueue(boss, DISH_ALERT_QUEUE, dependencies, (data) =>
    runDish(data, dependencies, clock),
  );
  await registerQueue(boss, ESCALATION_QUEUE, dependencies, (data) =>
    runEscalation(data, dependencies, clock),
  );
  await registerQueue(boss, SUGGESTION_QUEUE, dependencies, (data) =>
    runSuggestions(data, dependencies),
  );
};
