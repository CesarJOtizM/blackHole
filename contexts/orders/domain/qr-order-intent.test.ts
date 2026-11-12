import { expect, it } from "vitest";

import {
  QR_INTENT_NONE,
  QrIntentForbidden,
  QrOrderIntent,
} from "#domain/qr-order-intent.js";

const soup = {
  productId: "menu_product_soup",
  variantIds: [],
  modifierIds: [],
};

const steak = {
  productId: "menu_product_steak",
  variantIds: ["menu_variant_rare"],
  modifierIds: [],
  note: "no salt",
};

it("given two dishes and one intent id, when the intent is received, then one intent keeps that id", () => {
  const intent = QrOrderIntent.receive({
    id: "intent_1",
    lines: [soup, steak],
  });

  expect(intent).not.toBe(QR_INTENT_NONE);

  if (intent === QR_INTENT_NONE) {
    return;
  }

  expect(intent.id).toBe("intent_1");
  expect(intent.lines).toHaveLength(2);
  expect(intent.status).toBe("pending_acceptance");
});

it("given no lines, when an intent is received, then the result is none", () => {
  const intent = QrOrderIntent.receive({ id: "intent_1", lines: [] });

  expect(intent).toBe(QR_INTENT_NONE);
});

it("given a price, void, discount, or courtesy, when an intent is received, then it is rejected", () => {
  const receive = (extra: {
    price?: unknown;
    void?: unknown;
    discount?: unknown;
    courtesy?: unknown;
  }) => {
    QrOrderIntent.receive({
      id: "intent_1",
      lines: [soup],
      ...extra,
    });
  };

  expect(() => receive({ price: 12_000 })).toThrow(QrIntentForbidden);
  expect(() => receive({ void: true })).toThrow(QrIntentForbidden);
  expect(() => receive({ discount: 1_000 })).toThrow(QrIntentForbidden);
  expect(() => receive({ courtesy: true })).toThrow(QrIntentForbidden);
});

it("given a pending intent, when it is applied or rejected, then the status is applied or rejected", () => {
  const applied = QrOrderIntent.receive({ id: "intent_1", lines: [soup] });
  const rejected = QrOrderIntent.receive({ id: "intent_2", lines: [soup] });

  if (applied === QR_INTENT_NONE || rejected === QR_INTENT_NONE) {
    throw new Error("Expected an intent.");
  }

  applied.markApplied();
  rejected.reject();

  expect(applied.status).toBe("applied");
  expect(rejected.status).toBe("rejected");
});
