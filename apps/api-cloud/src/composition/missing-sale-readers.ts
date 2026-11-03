import {
  type OriginalPayment,
  OriginalPaymentReader,
  type PaidAccount,
  PaidAccountReader,
} from "@blackhole/cash-register/application/entry-port";

export class MissingPaidAccountReader extends PaidAccountReader {
  override find(
    _tenantId: string,
    _venueId: string,
    _paymentId: string,
  ): Promise<PaidAccount | null> {
    return Promise.resolve(null);
  }
}

export class MissingOriginalPaymentReader extends OriginalPaymentReader {
  override find(
    _tenantId: string,
    _venueId: string,
    _paymentId: string,
  ): Promise<OriginalPayment | null> {
    return Promise.resolve(null);
  }
}
