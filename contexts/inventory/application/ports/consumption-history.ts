export interface ConsumptionHour {
  weekStart: string;
  quantity: number;
}

export interface ConsumptionQuery {
  tenantId: string;
  locationId: string;
  ingredientId: string;
  weekday: number;
  slotStartMinute: number;
}

export abstract class ConsumptionHistory {
  abstract hours(query: ConsumptionQuery): Promise<readonly ConsumptionHour[]>;
}
