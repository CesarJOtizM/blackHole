import type { StockLevelRepository } from "#application/ports/stock-level-repository.js";
import { suggestReplenishment } from "#domain/transfer.js";

export interface SuggestReplenishmentInput {
  tenantId: string;
  locationId: string;
  ingredientId: string;
}

export interface OnHandReading {
  onHand: number;
}

export abstract class OnHandStock {
  abstract read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<OnHandReading | null>;
}

export class SuggestReplenishment {
  constructor(
    private readonly levels: StockLevelRepository,
    private readonly stock: OnHandStock,
  ) {}

  async execute(input: SuggestReplenishmentInput): Promise<number | undefined> {
    const level = await this.levels.find(
      input.tenantId,
      input.locationId,
      input.ingredientId,
    );

    if (!level) {
      return undefined;
    }

    const balance = await this.stock.read(
      input.tenantId,
      input.locationId,
      input.ingredientId,
    );

    if (!balance) {
      return undefined;
    }

    return suggestReplenishment({
      onHand: balance.onHand,
      minimum: level.minimum,
      maximum: level.maximum,
    });
  }
}
