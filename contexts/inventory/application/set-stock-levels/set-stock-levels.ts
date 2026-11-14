import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";

import type {
  ShortageRepository,
  SiteStockLevel,
} from "#application/ports/shortage-repository.js";
import { defineStockLevels } from "#domain/shortage-alert.js";

export class StockLevelsDenied extends Error {
  constructor() {
    super("Only inventory.configure-levels may set stock levels.");
    this.name = "StockLevelsDenied";
  }
}

export interface SetStockLevelsInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  ingredientId: string;
  sessionId: string;
  maximum: number;
  reorderPoint: number;
  minimum: number;
}

export class SetStockLevels {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly permissions: EvaluatePermission,
  ) {}

  async execute(input: SetStockLevelsInput): Promise<SiteStockLevel> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_CONFIGURE_LEVELS,
      target: {
        kind: "site",
        id: input.venueId,
        brandId: input.brandId,
      },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new StockLevelsDenied();
    }

    const levels = defineStockLevels({
      maximum: input.maximum,
      reorderPoint: input.reorderPoint,
      minimum: input.minimum,
    });
    const stored: SiteStockLevel = {
      tenantId: input.tenantId,
      venueId: input.venueId,
      ingredientId: input.ingredientId,
      maximum: levels.maximum,
      reorderPoint: levels.reorderPoint,
      minimum: levels.minimum,
    };

    await this.shortages.saveSiteLevel(stored);

    return stored;
  }
}
