import type { AvailabilityState } from "#domain/producible-quantity.js";

export interface AvailabilityChanged {
  siteId: string;
  productId: string;
  variantId: string | null;
  state: AvailabilityState;
}

export abstract class AvailabilityPublisher {
  abstract publish(notice: AvailabilityChanged): Promise<void>;
}
