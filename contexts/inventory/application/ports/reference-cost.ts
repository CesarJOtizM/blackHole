export abstract class ReferenceCostList {
  abstract costOf(tenantId: string, ingredientId: string): Promise<number>;
}
