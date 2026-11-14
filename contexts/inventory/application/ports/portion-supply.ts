import type { PortionCoverage } from "#domain/no-restock-today.js";

export interface PortionSupplyQuery {
  tenantId: string;
  venueId: string;
  productId: string;
}

export abstract class PortionSupply {
  abstract read(query: PortionSupplyQuery): Promise<PortionCoverage>;
}
