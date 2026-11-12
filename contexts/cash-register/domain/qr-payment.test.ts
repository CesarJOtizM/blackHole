import { expect, it } from "vitest";

import { QrPayment, QrPaymentConfirmed } from "#domain/qr-payment.js";

it("given a started charge, when it is inspected, then it is not QrPaymentConfirmed", () => {
  const started = QrPayment.start({
    reference: "qrpay_table_2",
    checkId: "orders_check_1",
    partId: null,
    balanceCop: 85_000,
    tipCop: 8_500,
    startedAt: 1_700_000_000_000,
  });

  expect(started.status).toBe("started");
  expect(started.reference).toBe("qrpay_table_2");
  expect(started.amountCop).toBe(93_500);
  expect(started.balanceCop).toBe(85_000);
  expect(started.tipCop).toBe(8_500);
  expect(started).not.toBeInstanceOf(QrPaymentConfirmed);

  const confirmed = started.confirm({
    reference: started.reference,
    amountCop: started.amountCop,
    instrument: "card",
  });

  expect(confirmed).toBeInstanceOf(QrPaymentConfirmed);
  expect(confirmed.status).toBe("confirmed");
  expect(started.status).toBe("started");
  expect(started).not.toBeInstanceOf(QrPaymentConfirmed);

  confirmed.markPendingApplication();

  expect(confirmed.status).toBe("pending_application");
  expect(confirmed).toBeInstanceOf(QrPaymentConfirmed);
});
