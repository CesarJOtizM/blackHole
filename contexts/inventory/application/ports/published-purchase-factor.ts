export abstract class PublishedPurchaseFactor {
  abstract factorOf(tenantId: string, ingredientId: string): Promise<number>;
}
