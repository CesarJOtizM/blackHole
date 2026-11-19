export interface ProducibleLimiter {
  ingredientId: string;
}

export interface PointProducibleUnits {
  units: number;
  limiters: readonly ProducibleLimiter[];
}

export abstract class ProducibleUnits {
  abstract atPoint(
    tenantId: string,
    venueId: string,
    productId: string,
  ): Promise<PointProducibleUnits | null>;
}
