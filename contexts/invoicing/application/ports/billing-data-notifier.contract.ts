import { expect, it } from "vitest";

import type {
  BillingDataNotice,
  BillingDataNotifier,
} from "#application/ports/billing-data-notifier.js";

export interface BillingDataNotifierHarness {
  notifier(): BillingDataNotifier;
  checkId(): string;
  delivered(): readonly BillingDataNotice[];
}

export function billingDataNotifierContract(
  open: () => BillingDataNotifierHarness | Promise<BillingDataNotifierHarness>,
): void {
  it("given a stored check, when billing_data_received is sent, then the register is notified once with that check id", async () => {
    const opened = await open();
    const checkId = opened.checkId();

    await opened.notifier().billingDataReceived({ checkId });

    expect(opened.delivered()).toEqual([{ checkId }]);
  });
}
