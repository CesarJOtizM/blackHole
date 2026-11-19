export interface QrNotRestockedQuery {
  tenantId: string;
  venueId: string;
  productId: string;
  at: Date;
}

export abstract class QrNotRestockedProducts {
  abstract execute(input: QrNotRestockedQuery): Promise<boolean>;
}
