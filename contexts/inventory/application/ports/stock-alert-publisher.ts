export interface NegativeStockOpenedEvent {
  type: "NegativeStockOpened";
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  balance: number;
  occurredAt: string;
}

export abstract class StockAlertPublisher {
  abstract publish(event: NegativeStockOpenedEvent): Promise<void>;
}
