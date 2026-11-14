import {
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  ConfigureProductionCost,
  InvalidProductionCost,
  ProductionCostDenied,
} from "#application/configure-production-cost/configure-production-cost.js";
import type {
  AppendProduction,
  ProductionCostPolicy,
  SaveProductionCostPolicy,
} from "#application/ports/production-repository.js";
import { ProductionRepository } from "#application/ports/production-repository.js";
import {
  PRODUCTION_COST_RULE,
  type ProductionCostRule,
} from "#domain/production.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const SAUCE_ID = "recipe_tomato_sauce";
const PASTA_ID = "recipe_pasta";
const OWNER_ID = "user_owner";
const CHIEF_ID = "user_kitchen_chief";
const SESSION_ID = "session_owner";
const DEVICE_ID = "device_office";
const RECIPE_EDIT = PERMISSION.RECIPE_EDIT;

const policyKey = (tenantId: string, recipeId: string): string =>
  `${tenantId}:${recipeId}`;

type Decision =
  | { outcome: "allowed"; selfAuthorized: false }
  | { outcome: "denied"; selfAuthorized: false };

const allowed: Decision = { outcome: "allowed", selfAuthorized: false };
const denied: Decision = { outcome: "denied", selfAuthorized: false };

class MemoryProduction extends ProductionRepository {
  readonly saved: SaveProductionCostPolicy[] = [];
  edits = 0;
  private rule: { tenantId: string; costRule: ProductionCostRule } | null =
    null;
  private readonly standards = new Map<string, number>();

  afterSales(): readonly never[] {
    return [];
  }

  override async findRun(): Promise<null> {
    return null;
  }

  override async balance(): Promise<number> {
    return 0;
  }

  override async averageCost(): Promise<number> {
    return 0;
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async policyFor(
    tenantId: string,
    recipeId: string,
  ): Promise<ProductionCostPolicy | null> {
    if (this.rule === null || this.rule.tenantId !== tenantId) {
      return null;
    }

    return {
      costRule: this.rule.costRule,
      standardUnitCost:
        this.standards.get(policyKey(tenantId, recipeId)) ?? null,
    };
  }

  override async append(_input: AppendProduction): Promise<void> {
    this.edits += 1;
    throw new Error("A production run cannot be edited.");
  }

  override async saveCostPolicy(
    input: SaveProductionCostPolicy,
  ): Promise<void> {
    this.rule = { tenantId: input.tenantId, costRule: input.costRule };

    for (const preparation of input.preparations) {
      this.standards.set(
        policyKey(input.tenantId, preparation.recipeId),
        preparation.standardUnitCost,
      );
    }

    this.saved.push({
      tenantId: input.tenantId,
      costRule: input.costRule,
      preparations: input.preparations.map((preparation) => ({
        ...preparation,
      })),
    });
  }
}

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: Parameters<EvaluatePermission["execute"]>[0][] = [];

  constructor(private readonly decision: Decision) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(
    input: Parameters<EvaluatePermission["execute"]>[0],
  ): Promise<Decision> {
    this.inputs.push(input);
    return Promise.resolve(this.decision);
  }
}

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

const harness = (decision: Decision) => {
  const production = new MemoryProduction();
  const permissions = new ScriptedPermission(decision);
  const audits = new CapturedAudit();
  const configure = new ConfigureProductionCost(
    permissions,
    production,
    audits,
  );

  return { production, permissions, audits, configure };
};

const command = (
  overrides: Partial<Parameters<ConfigureProductionCost["execute"]>[0]> = {},
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: OWNER_ID,
  authorizerId: null as string | null,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  preparations: [{ recipeId: SAUCE_ID, standardUnitCost: 5 }],
  ...overrides,
});

it("given recipe.edit, when the rule is consumed average and sauce costs 5, then that preparation keeps 5", async () => {
  const { production, permissions, audits, configure } = harness(allowed);

  await configure.execute(command());

  expect(permissions.inputs).toEqual([
    {
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      permission: RECIPE_EDIT,
      target: { kind: "company", id: TENANT_ID, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    },
  ]);
  expect(production.saved).toEqual([
    {
      tenantId: TENANT_ID,
      costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
      preparations: [{ recipeId: SAUCE_ID, standardUnitCost: 5 }],
    },
  ]);
  expect(await production.policyFor(TENANT_ID, SAUCE_ID)).toEqual({
    costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
    standardUnitCost: 5,
  });
  expect(await production.policyFor(OTHER_TENANT_ID, SAUCE_ID)).toBeNull();
  expect(production.edits).toBe(0);
  expect(production.afterSales()).toEqual([]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: OWNER_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: RECIPE_EDIT,
      entity: TENANT_ID,
      before: null,
      after: {
        costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
        preparations: [{ recipeId: SAUCE_ID, standardUnitCost: 5 }],
      },
      reason: "production-cost",
    },
  ]);
});

it("given recipe.edit, when the rule is standard, then each preparation keeps its standard unit cost", async () => {
  const { production, configure } = harness(allowed);

  await configure.execute(
    command({
      costRule: PRODUCTION_COST_RULE.STANDARD,
      preparations: [
        { recipeId: SAUCE_ID, standardUnitCost: 5 },
        { recipeId: PASTA_ID, standardUnitCost: 8 },
      ],
    }),
  );

  expect(await production.policyFor(TENANT_ID, SAUCE_ID)).toEqual({
    costRule: PRODUCTION_COST_RULE.STANDARD,
    standardUnitCost: 5,
  });
  expect(await production.policyFor(TENANT_ID, PASTA_ID)).toEqual({
    costRule: PRODUCTION_COST_RULE.STANDARD,
    standardUnitCost: 8,
  });
  expect(production.saved).toHaveLength(1);
  expect(production.afterSales()).toEqual([]);
});

it("given a kitchen chief, when the production cost is configured, then nothing changes", async () => {
  const { production, audits, configure } = harness(denied);

  await expect(
    configure.execute(command({ actorId: CHIEF_ID })),
  ).rejects.toThrow(ProductionCostDenied);
  expect(production.saved).toEqual([]);
  expect(production.edits).toBe(0);
  expect(production.afterSales()).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.policyFor(TENANT_ID, SAUCE_ID)).toBeNull();
});

it("given a negative standard unit cost, when the rule is standard, then it is rejected and nothing is stored", async () => {
  const { production, audits, configure } = harness(allowed);

  await expect(
    configure.execute(
      command({
        costRule: PRODUCTION_COST_RULE.STANDARD,
        preparations: [{ recipeId: SAUCE_ID, standardUnitCost: -1 }],
      }),
    ),
  ).rejects.toThrow(InvalidProductionCost);
  expect(production.saved).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.policyFor(TENANT_ID, SAUCE_ID)).toBeNull();
});

it("given an unknown cost rule, when it is configured, then it is rejected and nothing is stored", async () => {
  const { production, audits, configure } = harness(allowed);

  await expect(
    configure.execute(command({ costRule: "latest" as ProductionCostRule })),
  ).rejects.toThrow(InvalidProductionCost);
  expect(production.saved).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given a standard rule and no preparation, when it is configured, then it is rejected and nothing is stored", async () => {
  const { production, audits, configure } = harness(allowed);

  await expect(
    configure.execute(
      command({
        costRule: PRODUCTION_COST_RULE.STANDARD,
        preparations: [],
      }),
    ),
  ).rejects.toThrow(InvalidProductionCost);
  expect(production.saved).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given two costs for one preparation, when the rule is standard, then it is rejected and nothing is stored", async () => {
  const { production, audits, configure } = harness(allowed);

  await expect(
    configure.execute(
      command({
        costRule: PRODUCTION_COST_RULE.STANDARD,
        preparations: [
          { recipeId: SAUCE_ID, standardUnitCost: 5 },
          { recipeId: SAUCE_ID, standardUnitCost: 8 },
        ],
      }),
    ),
  ).rejects.toThrow(InvalidProductionCost);
  expect(production.saved).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.policyFor(TENANT_ID, SAUCE_ID)).toBeNull();
});
