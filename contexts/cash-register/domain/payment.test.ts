import { expect, it } from "vitest";

import {
  ChangeExceedsCash,
  IncompleteCard,
  MissingTip,
  Payment,
} from "#domain/payment.js";

const TERMINAL = "terminal_front";
const BRAND = "visa";
const LAST_4 = "4242";
const DECLINED_TIP = { method: "cash" as const, amountCop: 0 };

const cardTender = (amountCop: number, approvalNumber: string) =>
  ({
    method: "card",
    amountCop,
    terminal: TERMINAL,
    approvalNumber,
    brand: BRAND,
    last4: LAST_4,
  }) as const;

const viewOf = (payment: Payment) => ({
  id: payment.id,
  saleCop: payment.saleCop,
  changeCop: payment.changeCop,
  tenders: payment.tenders,
  tip: payment.tip,
});

it("given an account of 85000, when card 50000 and cash 40000 are recorded, then it is paid with 5000 change", () => {
  const payment = Payment.record({
    id: "payment_mixed_1",
    accountCop: 85_000,
    tenders: [
      cardTender(50_000, "AP-50000"),
      { method: "cash", amountCop: 40_000 },
    ],
    tip: DECLINED_TIP,
  });

  expect(viewOf(payment)).toEqual({
    id: "payment_mixed_1",
    saleCop: 85_000,
    changeCop: 5_000,
    tenders: [
      {
        method: "card",
        amountCop: 50_000,
        terminal: TERMINAL,
        approvalNumber: "AP-50000",
        brand: BRAND,
        last4: LAST_4,
      },
      { method: "cash", amountCop: 40_000 },
    ],
    tip: DECLINED_TIP,
  });
});

it("given an account of 85000, when the cash change is larger than the cash tender, then ChangeExceedsCash and nothing is stored", () => {
  const stored: Payment[] = [];

  const submit = () => {
    stored.push(
      Payment.record({
        id: "payment_change_exceeds",
        accountCop: 85_000,
        tenders: [
          cardTender(90_000, "AP-90000"),
          { method: "cash", amountCop: 1_000 },
        ],
        tip: DECLINED_TIP,
      }),
    );
  };

  expect(submit).toThrow(ChangeExceedsCash);
  expect(stored).toEqual([]);
});

it("given a card payment without an approval number, when the cashier submits it, then IncompleteCard and nothing is stored", () => {
  const stored: Payment[] = [];

  const submit = () => {
    stored.push(
      Payment.record({
        id: "payment_incomplete_card",
        accountCop: 50_000,
        tenders: [cardTender(50_000, "")],
        tip: DECLINED_TIP,
      }),
    );
  };

  expect(submit).toThrow(IncompleteCard);
  expect(stored).toEqual([]);
});

it("given a payment with no tip decision, when the cashier submits it, then MissingTip and nothing is stored", () => {
  const stored: Payment[] = [];

  const submit = () => {
    stored.push(
      Payment.record({
        id: "payment_missing_tip",
        accountCop: 85_000,
        tenders: [{ method: "cash", amountCop: 85_000 }],
      }),
    );
  };

  expect(submit).toThrow(MissingTip);
  expect(stored).toEqual([]);
});

it("given an account of 100000, when the customer adds a 10000 tip by card, then the sale stays 100000 and the card tip is 10000", () => {
  const payment = Payment.record({
    id: "payment_tip_apart",
    accountCop: 100_000,
    tenders: [{ method: "cash", amountCop: 100_000 }],
    tip: {
      method: "card",
      amountCop: 10_000,
      terminal: TERMINAL,
      approvalNumber: "AP-TIP",
      brand: BRAND,
      last4: LAST_4,
    },
  });

  expect(payment.saleCop).toBe(100_000);
  expect(payment.changeCop).toBe(0);
  expect(payment.tip).toEqual({
    method: "card",
    amountCop: 10_000,
    terminal: TERMINAL,
    approvalNumber: "AP-TIP",
    brand: BRAND,
    last4: LAST_4,
  });
  expect(payment.tenders).toEqual([{ method: "cash", amountCop: 100_000 }]);
});

it("given the customer declines the tip, when payment is recorded, then a zero tip is stored", () => {
  const payment = Payment.record({
    id: "payment_declined_tip",
    accountCop: 50_000,
    tenders: [{ method: "cash", amountCop: 50_000 }],
    tip: { method: "cash", amountCop: 0 },
  });

  expect(payment.tip).toEqual({ method: "cash", amountCop: 0 });
  expect(payment.saleCop).toBe(50_000);
});
