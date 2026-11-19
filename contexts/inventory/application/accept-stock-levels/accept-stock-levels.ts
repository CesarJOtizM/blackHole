import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";

import {
  type ShortageRepository,
  type SiteStockLevel,
  SUGGESTION_STATUS,
} from "#application/ports/shortage-repository.js";
import { defineStockLevels } from "#domain/shortage-alert.js";

export class AcceptStockLevelsDenied extends Error {
  constructor() {
    super("Only inventory.configure-levels may accept stock levels.");
    this.name = "AcceptStockLevelsDenied";
  }
}

export class SuggestedStockLevelNotFound extends Error {
  constructor() {
    super("Suggested stock levels were not found.");
    this.name = "SuggestedStockLevelNotFound";
  }
}

export interface AcceptStockLevelsInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  suggestionId: string;
  sessionId: string;
}

export class AcceptStockLevels {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly permissions: EvaluatePermission,
  ) {}

  async execute(input: AcceptStockLevelsInput): Promise<SiteStockLevel> {
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
      throw new AcceptStockLevelsDenied();
    }

    const suggestion = await this.shortages.findSuggestion(
      input.tenantId,
      input.suggestionId,
    );

    if (
      !suggestion ||
      suggestion.venueId !== input.venueId ||
      suggestion.status !== SUGGESTION_STATUS.PENDING
    ) {
      throw new SuggestedStockLevelNotFound();
    }

    const levels = defineStockLevels({
      maximum: suggestion.maximum,
      reorderPoint: suggestion.reorderPoint,
      minimum: suggestion.minimum,
    });
    const stored: SiteStockLevel = {
      tenantId: input.tenantId,
      venueId: input.venueId,
      ingredientId: suggestion.ingredientId,
      maximum: levels.maximum,
      reorderPoint: levels.reorderPoint,
      minimum: levels.minimum,
    };
    await this.shortages.saveSiteLevel(stored);
    await this.shortages.saveSuggestion({
      ...suggestion,
      maximum: levels.maximum,
      reorderPoint: levels.reorderPoint,
      minimum: levels.minimum,
      status: SUGGESTION_STATUS.ACTIVE,
    });

    return stored;
  }
}
