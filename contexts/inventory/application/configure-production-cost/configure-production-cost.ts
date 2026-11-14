import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import type {
  ProductionRepository,
  SaveProductionCostPolicy,
} from "#application/ports/production-repository.js";
import {
  PRODUCTION_COST_RULE,
  type ProductionCostRule,
} from "#domain/production.js";

const RECIPE_EDIT = PERMISSION.RECIPE_EDIT;
const COST_RULES = new Set<string>(Object.values(PRODUCTION_COST_RULE));

export class ProductionCostDenied extends Error {
  constructor() {
    super("Production cost needs recipe edit.");
    this.name = "ProductionCostDenied";
  }
}

export class InvalidProductionCost extends Error {
  constructor() {
    super(
      "Production cost is consumed average or standard, with one whole standard unit cost per preparation.",
    );
    this.name = "InvalidProductionCost";
  }
}

export interface ConfigureProductionCostInput {
  tenantId: string;
  venueId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  costRule: ProductionCostRule;
  preparations: readonly {
    recipeId: string;
    standardUnitCost: number;
  }[];
}

export class ConfigureProductionCost {
  constructor(
    private readonly permissions: EvaluatePermission,
    private readonly production: ProductionRepository,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ConfigureProductionCostInput): Promise<void> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: RECIPE_EDIT,
      target: { kind: "company", id: input.tenantId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new ProductionCostDenied();
    }

    assertPolicy(input);

    const policy: SaveProductionCostPolicy = {
      tenantId: input.tenantId,
      costRule: input.costRule,
      preparations: input.preparations.map((preparation) => ({
        recipeId: preparation.recipeId,
        standardUnitCost: preparation.standardUnitCost,
      })),
    };

    await this.production.saveCostPolicy(policy);
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: RECIPE_EDIT,
      entity: input.tenantId,
      before: null,
      after: {
        costRule: policy.costRule,
        preparations: policy.preparations,
      },
      reason: "production-cost",
    });
  }
}

function assertPolicy(input: ConfigureProductionCostInput): void {
  if (!COST_RULES.has(input.costRule)) {
    throw new InvalidProductionCost();
  }

  if (
    input.costRule === PRODUCTION_COST_RULE.STANDARD &&
    input.preparations.length === 0
  ) {
    throw new InvalidProductionCost();
  }

  const seen = new Set<string>();

  for (const preparation of input.preparations) {
    if (
      preparation.recipeId.length === 0 ||
      seen.has(preparation.recipeId) ||
      !Number.isInteger(preparation.standardUnitCost) ||
      preparation.standardUnitCost < 0
    ) {
      throw new InvalidProductionCost();
    }

    seen.add(preparation.recipeId);
  }
}
