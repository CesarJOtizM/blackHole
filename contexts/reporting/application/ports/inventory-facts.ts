export interface InventoryMovementLine {
  id: string;
  locationId: string;
  ingredientId: string;
  orderLineId: string | null;
  kind:
    | "purchase"
    | "transfer_in"
    | "production_output"
    | "sale_consumption"
    | "sale_return"
    | "production_consumption"
    | "waste";
  quantity: number;
  unitCost: number;
  occurredAt: string;
  recipeVersion: number | null;
}

export interface InventoryCountFact {
  locationId: string;
  ingredientId: string;
  quantity: number;
  approvedAt: string;
  averageCostCop: number;
}

export interface InventoryFactsQuery {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface InventorySnapshot {
  movements: InventoryMovementLine[];
  counts: InventoryCountFact[];
}

export interface StoredInventoryFacts {
  tenantId: string;
  venueId: string;
  movements: readonly InventoryMovementLine[];
  counts: readonly InventoryCountFact[];
}

export interface InventoryFacts {
  read(query: InventoryFactsQuery): Promise<InventorySnapshot>;
}
