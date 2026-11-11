export abstract class SitePrice {
  abstract priceOf(
    tenantId: string,
    venueId: string,
    productId: string,
    variantId?: string,
  ): Promise<number | null>;
}
