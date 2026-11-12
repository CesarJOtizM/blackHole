import * as contracts from "@blackhole/contracts";
import { expect, it } from "vitest";

it("given a table payment start, when the body includes an amount or a price, then strict parsing drops it and pending apply stays unpublished", () => {
  const command = contracts.startQrPaymentCommand;
  const start = { tipCop: 8_500 };

  expect(command.safeParse(start).success).toBe(true);
  expect(command.safeParse({ ...start, partId: "part_2" }).success).toBe(true);
  expect(command.safeParse({ ...start, amount: 10_000 }).success).toBe(false);
  expect(command.safeParse({ ...start, amountCop: 10_000 }).success).toBe(
    false,
  );
  expect(command.safeParse({ ...start, price: 22_000 }).success).toBe(false);
  expect(command.safeParse({}).success).toBe(false);
  expect("qrPaymentPendingApply" in contracts).toBe(false);
  expect("QrPaymentPendingApply" in contracts).toBe(false);

  const count = contracts.cashCountView;

  expect(count.safeParse({ state: "open" }).success).toBe(true);
  expect(
    count.safeParse({
      state: "counting",
      countedCashCop: 300_000,
      differenceCop: 0,
      qrCop: 120_000,
      qrReportCop: 120_000,
    }).success,
  ).toBe(true);
});
