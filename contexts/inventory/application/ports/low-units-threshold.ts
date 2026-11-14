export abstract class LowUnitsThreshold {
  abstract thresholdOf(
    tenantId: string,
    siteId: string,
    productId: string,
    variantId: string | null,
  ): Promise<number | null>;
}
