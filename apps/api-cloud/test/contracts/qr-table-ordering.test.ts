import * as contracts from "@blackhole/contracts";
import { expect, it } from "vitest";

const line = {
  productId: "menu_product_soup",
  variantIds: [],
  modifierIds: [],
};

it("given a QR order command, when it carries a price, void, discount, or courtesy, then strict parsing rejects it and pending apply stays unpublished", () => {
  const command = contracts.submitQrOrderCommand;
  const order = { intentId: "intent_1", lines: [line] };

  expect(command.safeParse(order).success).toBe(true);
  expect(command.safeParse({ ...order, price: 22_000 }).success).toBe(false);
  expect(command.safeParse({ ...order, void: true }).success).toBe(false);
  expect(command.safeParse({ ...order, discount: 10 }).success).toBe(false);
  expect(command.safeParse({ ...order, courtesy: true }).success).toBe(false);
  expect("qrOrderPendingApply" in contracts).toBe(false);
  expect("QrOrderPendingApply" in contracts).toBe(false);
  expect(contracts.orderChannel.safeParse("qr_table").success).toBe(true);
  expect(contracts.orderChannel.safeParse("waiter").success).toBe(true);
});
