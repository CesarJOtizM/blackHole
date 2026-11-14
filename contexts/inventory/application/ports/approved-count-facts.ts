export interface ApprovedCountFact {
  locationId: string;
  ingredientId: string;
  quantity: number;
  approvedAt: string;
}

// No rows until a p2-06 frozen session exists. This port has no snapshot table.
export class ApprovedCountFacts {
  listByVenue(
    _tenantId: string,
    _venueId: string,
  ): Promise<readonly ApprovedCountFact[]> {
    return Promise.resolve([]);
  }
}
