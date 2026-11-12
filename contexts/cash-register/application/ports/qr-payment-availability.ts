export abstract class QrPaymentAvailability {
  abstract enabled(tenantId: string, venueId: string): Promise<boolean>;
}
