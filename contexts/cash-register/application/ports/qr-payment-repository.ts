import type {
  QrPayment,
  QrPaymentConfirmed,
  QrPaymentStatus,
} from "#domain/qr-payment.js";

export type StoredQrPayment = QrPayment | QrPaymentConfirmed;

export abstract class QrPaymentRepository {
  abstract findByReference(
    tenantId: string,
    venueId: string,
    reference: string,
  ): Promise<StoredQrPayment | null>;

  abstract listStarted(
    tenantId: string,
    venueId: string,
  ): Promise<readonly QrPayment[]>;

  abstract listByStatus(
    tenantId: string,
    venueId: string,
    status: QrPaymentStatus,
  ): Promise<readonly StoredQrPayment[]>;

  abstract save(
    tenantId: string,
    venueId: string,
    payment: StoredQrPayment,
  ): Promise<void>;

  abstract putStarted(
    tenantId: string,
    venueId: string,
    payment: QrPayment,
  ): Promise<void>;
}
