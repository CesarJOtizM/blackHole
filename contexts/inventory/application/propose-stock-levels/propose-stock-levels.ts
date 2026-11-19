import {
  type ShortageRepository,
  SUGGESTION_STATUS,
  type SuggestedStockLevel,
} from "#application/ports/shortage-repository.js";
import {
  defineStockLevels,
  InvalidStockLevels,
} from "#domain/shortage-alert.js";

export interface ProposeStockLevelsInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  dailyConsumption: number;
  leadTimeDays: number;
}

export class ProposeStockLevels {
  constructor(private readonly shortages: ShortageRepository) {}

  async execute(input: ProposeStockLevelsInput): Promise<SuggestedStockLevel> {
    if (
      !Number.isInteger(input.dailyConsumption) ||
      input.dailyConsumption < 0 ||
      !Number.isInteger(input.leadTimeDays) ||
      input.leadTimeDays < 1
    ) {
      throw new InvalidStockLevels();
    }

    const active = await this.shortages.effectiveLevels({
      tenantId: input.tenantId,
      brandId: input.brandId,
      venueId: input.venueId,
      locationId: input.locationId,
      ingredientId: input.ingredientId,
    });
    const minimum = active?.minimum ?? 0;
    const leadCover = input.dailyConsumption * input.leadTimeDays;
    const reorderPoint = Math.max(leadCover, minimum);
    const maximum = Math.max(leadCover + leadCover, reorderPoint);
    const levels = defineStockLevels({ maximum, reorderPoint, minimum });
    const suggestion: SuggestedStockLevel = {
      id: `suggestion:${input.tenantId}:${input.venueId}:${input.ingredientId}`,
      tenantId: input.tenantId,
      brandId: input.brandId,
      venueId: input.venueId,
      locationId: input.locationId,
      ingredientId: input.ingredientId,
      maximum: levels.maximum,
      reorderPoint: levels.reorderPoint,
      minimum: levels.minimum,
      leadTimeDays: input.leadTimeDays,
      status: SUGGESTION_STATUS.PENDING,
    };
    await this.shortages.saveSuggestion(suggestion);

    return suggestion;
  }
}
