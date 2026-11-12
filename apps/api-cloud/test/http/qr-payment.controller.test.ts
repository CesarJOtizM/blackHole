import { createHmac } from "node:crypto";

import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import {
  ApplyQrPayment,
  ConfirmQrPayment,
  type GatewayReportQuery,
  type GatewayReportRow,
  PaymentGateway,
  QrInvoiceIssuer,
  QrPaymentAvailability,
  QrPaymentRepository,
  type StartCharge,
  StartQrPayment,
  type StoredQrPayment,
  type VerifiedWebhook,
  type WebhookRequest,
} from "@blackhole/cash-register/application/entry-port";
import {
  AccountSplit,
  CashShift,
  QrPayment,
  QrPaymentConfirmed,
} from "@blackhole/cash-register/domain";
import { expect, it } from "vitest";
import {
  QrPaymentController,
  QrTableAccess,
  type QrTableContext,
  qrPaymentWebhookPath,
  qrTableBalancePath,
  qrTablePaymentPath,
} from "#src/http/qr-payment.controller.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_table_2";
const REGISTER_ID = "register_1";
const TOKEN = "table-token";
const REFERENCE = "qrpay_table_1";
const BALANCE_COP = 85_000;
const TIP_COP = 8_500;
const SERVER_AMOUNT_COP = 93_500;
const SECRET = "bold-webhook-secret";

class ServerAccounts {
  async findCheck(
    _tenantId: string,
    _venueId: string,
    checkId: string,
  ): Promise<{
    checkId: string;
    tableId: string;
    accountCop: number;
    lines: [];
  }> {
    return {
      checkId,
      tableId: "table_2",
      accountCop: BALANCE_COP,
      lines: [],
    };
  }

  async markPaid(): Promise<void> {}
}

class EmptySplits {
  async find(): Promise<null> {
    return null;
  }

  async save(): Promise<void> {}
}

class EnabledPayments extends QrPaymentAvailability {
  override async enabled(): Promise<boolean> {
    return true;
  }
}

class MemoryQrPayments extends QrPaymentRepository {
  private readonly rows = new Map<string, StoredQrPayment>();

  override async findByReference(
    _tenantId: string,
    _venueId: string,
    reference: string,
  ): Promise<StoredQrPayment | null> {
    return this.rows.get(reference) ?? null;
  }

  override async listStarted(): Promise<readonly QrPayment[]> {
    return [...this.rows.values()].filter(
      (payment): payment is QrPayment => payment.status === "started",
    );
  }

  override async listByStatus(
    _tenantId: string,
    _venueId: string,
    status: StoredQrPayment["status"],
  ): Promise<readonly StoredQrPayment[]> {
    return [...this.rows.values()].filter(
      (payment) => payment.status === status,
    );
  }

  override async save(
    _tenantId: string,
    _venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    this.rows.set(payment.reference, payment);
  }

  override async putStarted(
    _tenantId: string,
    _venueId: string,
    payment: StoredQrPayment,
  ): Promise<void> {
    this.rows.set(payment.reference, payment);
  }
}

class RecordingGateway extends PaymentGateway {
  readonly charges: StartCharge[] = [];

  readonly requests: WebhookRequest[] = [];

  override async startCharge(
    input: StartCharge,
  ): Promise<{ reference: string; redirectUrl: string }> {
    this.charges.push(input);

    return {
      reference: input.reference,
      redirectUrl: `https://checkout.bold.co/pay/${input.reference}?amount=${input.amountCop}`,
    };
  }

  override async verifyWebhook(
    input: WebhookRequest,
  ): Promise<VerifiedWebhook | null> {
    this.requests.push(input);
    const expected = createHmac("sha256", SECRET)
      .update(input.rawBody)
      .digest("hex");

    if (input.signature.length !== expected.length) {
      return null;
    }

    if (input.signature !== expected) {
      return null;
    }

    const parsed: unknown = JSON.parse(input.rawBody);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("reference" in parsed) ||
      !("amountCop" in parsed) ||
      !("instrument" in parsed)
    ) {
      return null;
    }

    const { reference, amountCop, instrument } = parsed;

    if (
      typeof reference !== "string" ||
      typeof amountCop !== "number" ||
      typeof instrument !== "string"
    ) {
      return null;
    }

    return {
      reference,
      amountCop,
      instrument: instrument as VerifiedWebhook["instrument"],
    };
  }

  override async report(
    _input: GatewayReportQuery,
  ): Promise<readonly GatewayReportRow[]> {
    return [];
  }
}

class IdleIssuer extends QrInvoiceIssuer {
  override async execute(): Promise<{ document: { status: string } }> {
    return { document: { status: "accepted" } };
  }
}

class FixedTable extends QrTableAccess {
  override async resolve(token: string): Promise<QrTableContext | null> {
    if (token !== TOKEN) {
      return null;
    }

    return {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      registerId: REGISTER_ID,
      balanceCop: BALANCE_COP,
    };
  }
}

const sign = (rawBody: string): string =>
  createHmac("sha256", SECRET).update(rawBody).digest("hex");

const rawWebhook = (): string =>
  `{"instrument": "nequi", "amountCop": ${SERVER_AMOUNT_COP}, "reference": "${REFERENCE}", "tenantId": "${TENANT_ID}", "venueId": "${VENUE_ID}", "registerId": "${REGISTER_ID}"}`;

const harness = (): {
  controller: QrPaymentController;
  gateway: RecordingGateway;
  payments: MemoryQrPayments;
} => {
  const payments = new MemoryQrPayments();
  const gateway = new RecordingGateway();
  const controller = new QrPaymentController(
    new FixedTable(),
    new StartQrPayment(
      new ServerAccounts(),
      new EmptySplits(),
      payments,
      gateway,
      new EnabledPayments(),
      () => REFERENCE,
      { now: () => Date.parse("2026-11-11T19:00:00.000Z") },
    ),
    new ConfirmQrPayment(payments, gateway),
    new ApplyQrPayment(
      payments,
      new InMemoryCashRegisterRepository(),
      new IdleIssuer(),
    ),
  );

  return { controller, gateway, payments };
};

it("given a table balance of 85000, when the customer sends a tip and a client amount, then the server charges 93500 and the payment stays started", async () => {
  const { controller, gateway, payments } = harness();

  expect(qrTableBalancePath).toBe("d/:token");
  expect(qrTablePaymentPath).toBe("d/:token/payments");
  expect(qrTableBalancePath).not.toContain("m/");

  const balance = await controller.readBalance(TOKEN);
  const started = await controller.start(TOKEN, {
    tipCop: TIP_COP,
    amount: 10_000,
  });
  const stored = await payments.findByReference(
    TENANT_ID,
    VENUE_ID,
    started.reference,
  );

  expect(balance).toEqual({ balanceCop: BALANCE_COP });
  expect(started.amountCop).toBe(SERVER_AMOUNT_COP);
  expect(started.balanceCop).toBe(BALANCE_COP);
  expect(started.reference.startsWith("qrpay_")).toBe(true);
  expect(started.status).toBe("started");
  expect(gateway.charges).toEqual([
    { reference: REFERENCE, amountCop: SERVER_AMOUNT_COP },
  ]);
  expect(gateway.requests).toEqual([]);
  expect(stored?.status).toBe("started");
  expect(stored).not.toBeInstanceOf(QrPaymentConfirmed);
});

it("given a started qrpay charge, when the raw webhook arrives twice without a session, then one payment exists and a forged signature confirms nothing", async () => {
  const { controller, gateway, payments } = harness();
  const rawBody = rawWebhook();

  expect(qrPaymentWebhookPath).toBe("payments/bold/webhook");
  expect(QrPaymentController.prototype.receiveWebhook.length).toBe(2);
  await controller.start(TOKEN, { tipCop: TIP_COP, amount: 10_000 });

  const forged = await controller.receiveWebhook(rawBody, "forged-signature");
  const storedAfterForgery = await payments.findByReference(
    TENANT_ID,
    VENUE_ID,
    REFERENCE,
  );
  const first = await controller.receiveWebhook(rawBody, sign(rawBody));
  const second = await controller.receiveWebhook(rawBody, sign(rawBody));
  const pending = await payments.listByStatus(
    TENANT_ID,
    VENUE_ID,
    "pending_application",
  );

  expect(forged).toEqual({ confirmed: false });
  expect(storedAfterForgery?.status).toBe("started");
  expect(first).toMatchObject({
    confirmed: true,
    reference: REFERENCE,
    status: "pending_application",
  });
  expect(second).toMatchObject({
    confirmed: true,
    reference: REFERENCE,
  });
  expect(pending).toHaveLength(1);
  expect(gateway.requests.map((request) => request.rawBody)).toEqual([
    rawBody,
    rawBody,
    rawBody,
  ]);
});

const PART_REFERENCE = "qrpay_part_1";
const PART_ONE_COP = 45_000;
const PART_TWO_COP = 40_000;
const OPENING_CASH_COP = 200_000;
const QR_COP = 120_000;
const NOW = Date.parse("2026-11-11T19:00:00.000Z");

class CountingAccounts extends ServerAccounts {
  marks = 0;

  override async markPaid(): Promise<void> {
    this.marks += 1;
  }
}

class SplitBook {
  readonly split = AccountSplit.create({
    accountCop: BALANCE_COP,
    parts: [
      {
        id: "part_1",
        amountCop: PART_ONE_COP,
        originTableId: "table_2",
      },
      {
        id: "part_2",
        amountCop: PART_TWO_COP,
        originTableId: "table_2",
      },
    ],
  });

  async find(): Promise<AccountSplit> {
    return this.split;
  }

  async save(): Promise<void> {}
}

class PartPayer {
  constructor(private readonly book: SplitBook) {}

  async pay(input: { partId: string }): Promise<AccountSplit> {
    this.book.split.pay(input.partId);

    return this.book.split;
  }
}

class UpdatingRegisters {
  private shift: CashShift | null = null;

  async load(): Promise<CashShift | null> {
    return this.shift;
  }

  async save(
    _tenantId: string,
    _venueId: string,
    shift: CashShift,
  ): Promise<void> {
    this.shift = shift;
  }
}

const partWebhook = (): string =>
  `{"instrument": "nequi", "amountCop": ${PART_ONE_COP}, "reference": "${PART_REFERENCE}", "tenantId": "${TENANT_ID}", "venueId": "${VENUE_ID}", "registerId": "${REGISTER_ID}"}`;

it("given a split account, when part 1 is paid, then part 2 stays payable and the table stays occupied", async () => {
  const payments = new MemoryQrPayments();
  const gateway = new RecordingGateway();
  const accounts = new CountingAccounts();
  const book = new SplitBook();
  const registers = new UpdatingRegisters();
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id: "shift_1",
    cashierId: "cashier_1",
    openingFloatCop: OPENING_CASH_COP,
  });
  await registers.save(TENANT_ID, VENUE_ID, shift);
  const controller = new QrPaymentController(
    new FixedTable(),
    new StartQrPayment(
      accounts,
      book,
      payments,
      gateway,
      new EnabledPayments(),
      () => PART_REFERENCE,
      { now: () => NOW },
    ),
    new ConfirmQrPayment(payments, gateway),
    new ApplyQrPayment(
      payments,
      registers,
      new IdleIssuer(),
      accounts,
      new PartPayer(book),
    ),
    {
      async remaining() {
        return book.split.parts
          .filter((part) => !part.paid)
          .map((part) => ({
            partId: part.id,
            balanceCop: part.amountCop,
          }));
      },
      async stale() {
        return [];
      },
      async count() {
        return {
          countedCashCop: 300_000,
          expectedCashCop: OPENING_CASH_COP,
          qrCop: QR_COP,
        };
      },
    },
  );
  const rawBody = partWebhook();

  await controller.start(TOKEN, {
    tipCop: 0,
    partId: "part_1",
    amount: 10_000,
  });
  const paid = await controller.receiveWebhook(rawBody, sign(rawBody));

  expect(paid).toMatchObject({
    confirmed: true,
    reference: PART_REFERENCE,
    occupied: true,
    remaining: [{ partId: "part_2", balanceCop: PART_TWO_COP }],
  });
  expect(accounts.marks).toBe(0);
  expect(book.split.parts.find((part) => part.id === "part_2")?.paid).toBe(
    false,
  );
  expect(gateway.charges[0]?.amountCop).toBe(PART_ONE_COP);
});

it("given a pending payment older than 900 seconds, when the register asks, then that payment is visible and qr stays out of expected cash", async () => {
  const payments = new MemoryQrPayments();
  const stalePayment = QrPayment.start({
    reference: "qrpay_stale",
    checkId: CHECK_ID,
    partId: null,
    balanceCop: QR_COP,
    tipCop: 0,
    startedAt: NOW - 900_001,
  }).confirm({
    reference: "qrpay_stale",
    amountCop: QR_COP,
    instrument: "nequi",
  });
  stalePayment.markPendingApplication();
  await payments.save(TENANT_ID, VENUE_ID, stalePayment);
  const fresh = QrPayment.start({
    reference: "qrpay_fresh",
    checkId: CHECK_ID,
    partId: null,
    balanceCop: 1_000,
    tipCop: 0,
    startedAt: NOW - 900_000,
  }).confirm({
    reference: "qrpay_fresh",
    amountCop: 1_000,
    instrument: "card",
  });
  fresh.markPendingApplication();
  await payments.save(TENANT_ID, VENUE_ID, fresh);
  const controller = new QrPaymentController(
    new FixedTable(),
    new StartQrPayment(
      new ServerAccounts(),
      new EmptySplits(),
      payments,
      new RecordingGateway(),
      new EnabledPayments(),
      () => REFERENCE,
      { now: () => NOW },
    ),
    new ConfirmQrPayment(payments, new RecordingGateway()),
    new ApplyQrPayment(
      payments,
      new InMemoryCashRegisterRepository(),
      new IdleIssuer(),
    ),
    {
      async remaining() {
        return [];
      },
      async stale() {
        return (
          await payments.listByStatus(
            TENANT_ID,
            VENUE_ID,
            "pending_application",
          )
        )
          .filter((payment) => NOW - payment.startedAt > 900_000)
          .map((payment) => ({
            reference: payment.reference,
            status: "pending_application" as const,
          }));
      },
      async count() {
        return {
          countedCashCop: 300_000,
          expectedCashCop: OPENING_CASH_COP,
          qrCop: QR_COP,
        };
      },
    },
  );

  const listed = await controller.listStale(TOKEN);
  const count = await controller.readCount(TOKEN);

  expect(listed).toEqual([
    { reference: "qrpay_stale", status: "pending_application" },
  ]);
  expect(count.qrCop).toBe(QR_COP);
  expect(count.expectedCashCop).toBe(OPENING_CASH_COP);
  expect(count.countedCashCop).toBe(300_000);
});
