import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";

import type {
  ShortageRepository,
  SiteStockLevel,
} from "#application/ports/shortage-repository.js";
import type {
  StockLevel,
  StockLevelRepository,
} from "#application/ports/stock-level-repository.js";
import {
  defineStockLevels,
  InvalidStockLevels,
} from "#domain/shortage-alert.js";

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

export interface LocationStockLevelsInput {
  tenantId: string;
  locationId: string;
  ingredientId: string;
  minimum: number;
  maximum: number;
}

export class MissingLocationLevels extends Error {
  constructor() {
    super("Location stock levels need a stock level repository.");
    this.name = "MissingLocationLevels";
  }
}

const wholeScaled = (value: number): boolean => Number.isInteger(value);

const isLocationLevel = (
  input: SetStockLevelsInput | LocationStockLevelsInput,
): input is LocationStockLevelsInput => "locationId" in input;

export class SetStockLevels {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly permissions: EvaluatePermission,
    private readonly locationLevels: StockLevelRepository | null = null,
  ) {}

  async execute(input: SetStockLevelsInput): Promise<SiteStockLevel>;
  async execute(input: LocationStockLevelsInput): Promise<StockLevel>;
  async execute(
    input: SetStockLevelsInput | LocationStockLevelsInput,
  ): Promise<SiteStockLevel | StockLevel> {
    if (isLocationLevel(input)) {
      return this.saveScaledLocation(input);
    }

    return this.saveSiteLevel(input);
  }

  private async saveScaledLocation(
    input: LocationStockLevelsInput,
  ): Promise<StockLevel> {
    if (
      !wholeScaled(input.minimum) ||
      !wholeScaled(input.maximum) ||
      input.minimum < 0 ||
      input.maximum < input.minimum
    ) {
      throw new InvalidStockLevels();
    }

    if (!this.locationLevels) {
      throw new MissingLocationLevels();
    }

    const stored: StockLevel = {
      locationId: input.locationId,
      ingredientId: input.ingredientId,
      minimum: input.minimum,
      maximum: input.maximum,
    };

    await this.locationLevels.save(input.tenantId, stored);

    return stored;
  }

  private async saveSiteLevel(
    input: SetStockLevelsInput,
  ): Promise<SiteStockLevel> {
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
