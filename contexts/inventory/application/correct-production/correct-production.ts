import {
  type ConsumeAuthorization,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import type {
  AppendProductionCompensation,
  ProductionCompensationLine,
  ProductionRepository,
  RecordedProductionRun,
} from "#application/ports/production-repository.js";
import {
  InvalidProduction,
  PRODUCTION_COST_RULE,
  ProductionAlreadyCompensated,
  type ProductionMovement,
  ProductionRun,
} from "#domain/production.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const ADJUST = PERMISSION.INVENTORY_ADJUST;

export class ProductionCorrectionDenied extends Error {
  constructor() {
    super(
      "Correcting a production run needs inventory adjust or a supervisor authorization.",
    );
    this.name = "ProductionCorrectionDenied";
  }
}

export class UnknownProductionRun extends Error {
  constructor() {
    super("The production run is not in this organization.");
    this.name = "UnknownProductionRun";
  }
}

export interface CorrectProductionInput {
  tenantId: string;
  venueId: string;
  originalRunId: string;
  correctionRunId: string;
  occurredAt: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  authorizationId: string | null;
}

const scale = (quantity: number): number => quantity * QUANTITY_SCALE;

const unscale = (quantity: number): number => {
  if (!Number.isInteger(quantity) || quantity % QUANTITY_SCALE !== 0) {
    throw new InvalidProduction();
  }

  return quantity / QUANTITY_SCALE;
};

export class CorrectProduction {
  constructor(
    private readonly production: ProductionRepository,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    input: CorrectProductionInput,
  ): Promise<AppendProductionCompensation> {
    const permitted = await this.permit(input);

    if (!permitted) {
      throw new ProductionCorrectionDenied();
    }

    const original = await this.production.findRun(
      input.tenantId,
      input.originalRunId,
    );

    if (!original) {
      throw new UnknownProductionRun();
    }

    const existing = await this.production.findCompensation(
      input.tenantId,
      input.originalRunId,
    );

    if (existing) {
      throw new ProductionAlreadyCompensated();
    }

    const correction: AppendProductionCompensation = {
      tenantId: input.tenantId,
      originalRunId: original.runId,
      correctionRunId: input.correctionRunId,
      movements: compensate(original, input),
    };

    await this.production.appendCompensation(correction);
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: ADJUST,
      entity: original.runId,
      before: {
        runId: original.runId,
        movements: original.movements.map((movement) => ({
          id: movement.id,
          quantity: movement.quantity,
        })),
      },
      after: {
        correctionRunId: input.correctionRunId,
        movements: correction.movements.map((movement) => ({
          id: movement.id,
          quantity: movement.quantity,
          reversesMovementId: movement.reversesMovementId,
        })),
      },
      reason: "production-compensation",
    });

    return correction;
  }

  private async permit(input: CorrectProductionInput): Promise<boolean> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: ADJUST,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome === "allowed") {
      return true;
    }

    if (input.authorizationId === null) {
      return false;
    }

    return this.grants.execute({
      tenantId: input.tenantId,
      authorizationId: input.authorizationId,
      permission: ADJUST,
      targetId: input.venueId,
      value: null,
    });
  }
}

function compensate(
  run: RecordedProductionRun,
  input: CorrectProductionInput,
): ProductionCompensationLine[] {
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );
  const burned = run.actualQuantity === 0;

  if (burned && output !== undefined) {
    throw new InvalidProduction();
  }

  if (!burned && output === undefined) {
    throw new InvalidProduction();
  }

  const lines: {
    ingredientId: string;
    quantity: number;
    unitCost: number;
  }[] = [];

  for (const movement of run.movements) {
    if (movement.type !== MOVEMENT_TYPE.PRODUCTION_CONSUMPTION) {
      continue;
    }

    const quantity = unscale(movement.quantity);

    if (quantity >= 0) {
      throw new InvalidProduction();
    }

    lines.push({
      ingredientId: movement.ingredientId,
      quantity: -quantity,
      unitCost: movement.unitCost,
    });
  }

  const recorded = ProductionRun.record({
    runId: run.runId,
    locationId: run.locationId,
    recipeId: run.recipeId,
    outputQuantity: run.expectedQuantity,
    expectedQuantity: run.expectedQuantity,
    actualQuantity: run.actualQuantity,
    lines,
    costRule:
      output === undefined
        ? PRODUCTION_COST_RULE.CONSUMED_AVERAGE
        : PRODUCTION_COST_RULE.STANDARD,
    ...(output === undefined ? {} : { standardUnitCost: output.unitCost }),
  });
  const compensated = recorded.compensate({ runId: input.correctionRunId });

  return compensated.map((movement) => compensationLine(input, run, movement));
}

function compensationLine(
  input: CorrectProductionInput,
  run: RecordedProductionRun,
  movement: ProductionMovement,
): ProductionCompensationLine {
  if (movement.reversesMovementId === undefined) {
    throw new InvalidProduction();
  }

  return {
    id: movement.id,
    tenantId: input.tenantId,
    venueId: run.venueId,
    locationId: movement.locationId,
    ingredientId: movement.ingredientId,
    quantity: scale(movement.quantity),
    unitCost: movement.unitCost,
    type: movement.type,
    reference: movement.reference,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    orderLineId: null,
    role: null,
    recipeVersion: run.recipeVersion,
    reversesMovementId: movement.reversesMovementId,
  };
}
