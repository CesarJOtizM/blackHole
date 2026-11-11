export interface BillingDataNotice {
  checkId: string;
}

export abstract class BillingDataNotifier {
  abstract billingDataReceived(notice: BillingDataNotice): Promise<void>;
}
