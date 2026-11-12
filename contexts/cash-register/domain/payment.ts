import { InvalidCashAmount } from "#domain/cash-shift.js";

const PAYMENT_ID_PREFIX = "payment_";

const PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
  WALLET: "wallet",
  VOUCHER: "voucher",
  CUSTOMER_CREDIT: "customer_credit",
  CORPORATE_CREDIT: "corporate_credit",
  QR: "qr",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

type PlainPaymentMethod = Exclude<
  PaymentMethod,
  typeof PAYMENT_METHOD.CASH | typeof PAYMENT_METHOD.CARD
>;

type PlainTipMethod = Exclude<PaymentMethod, typeof PAYMENT_METHOD.CARD>;

export interface CashTender {
  method: typeof PAYMENT_METHOD.CASH;
  amountCop: number;
}

export interface CardTender {
  method: typeof PAYMENT_METHOD.CARD;
  amountCop: number;
  terminal: string;
  approvalNumber: string;
  brand: string;
  last4: string;
}

export interface PlainTender {
  method: PlainPaymentMethod;
  amountCop: number;
}

export type PaymentTender = CashTender | CardTender | PlainTender;

export interface PlainTip {
  method: PlainTipMethod;
  amountCop: number;
}

export interface CardTip {
  method: typeof PAYMENT_METHOD.CARD;
  amountCop: number;
  terminal: string;
  approvalNumber: string;
  brand: string;
  last4: string;
}

export type PaymentTip = PlainTip | CardTip;

interface RecordPayment {
  id: string;
  accountCop: number;
  tenders: readonly PaymentTender[];
  tip?: PaymentTip;
}

interface CardCapture {
  terminal: string;
  approvalNumber: string;
  brand: string;
  last4: string;
}

export class IncompleteCard extends Error {
  constructor() {
    super(
      "A card payment requires a terminal, approval number, brand, and last 4 digits.",
    );
    this.name = "IncompleteCard";
  }
}

export class MissingTip extends Error {
  constructor() {
    super("A payment requires a tip decision.");
    this.name = "MissingTip";
  }
}

export class ChangeExceedsCash extends Error {
  constructor() {
    super("Cash change cannot exceed the cash tender.");
    this.name = "ChangeExceedsCash";
  }
}

export class InvalidPaymentId extends Error {
  constructor() {
    super("A payment identifier must use the payment_ prefix.");
    this.name = "InvalidPaymentId";
  }
}

class AccountNotCovered extends Error {
  constructor() {
    super("The tenders do not cover the account.");
    this.name = "AccountNotCovered";
  }
}

function assertPaymentId(id: string): void {
  if (
    !id.startsWith(PAYMENT_ID_PREFIX) ||
    id.length === PAYMENT_ID_PREFIX.length
  ) {
    throw new InvalidPaymentId();
  }
}

function assertCop(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidCashAmount();
  }
}

function assertCardCapture(card: CardCapture): void {
  if (
    card.terminal.trim().length === 0 ||
    card.approvalNumber.trim().length === 0 ||
    card.brand.trim().length === 0 ||
    !/^\d{4}$/.test(card.last4)
  ) {
    throw new IncompleteCard();
  }
}

function recordedTender(tender: PaymentTender): PaymentTender {
  assertCop(tender.amountCop);

  switch (tender.method) {
    case PAYMENT_METHOD.CASH:
      return {
        method: PAYMENT_METHOD.CASH,
        amountCop: tender.amountCop,
      };
    case PAYMENT_METHOD.CARD:
      assertCardCapture(tender);
      return {
        method: PAYMENT_METHOD.CARD,
        amountCop: tender.amountCop,
        terminal: tender.terminal,
        approvalNumber: tender.approvalNumber,
        brand: tender.brand,
        last4: tender.last4,
      };
    case PAYMENT_METHOD.TRANSFER:
    case PAYMENT_METHOD.WALLET:
    case PAYMENT_METHOD.VOUCHER:
    case PAYMENT_METHOD.CUSTOMER_CREDIT:
    case PAYMENT_METHOD.CORPORATE_CREDIT:
    case PAYMENT_METHOD.QR:
      return {
        method: tender.method,
        amountCop: tender.amountCop,
      };
    default: {
      const unexpected: never = tender;
      throw new Error(`Unexpected payment method: ${String(unexpected)}`);
    }
  }
}

function recordedTip(tip: PaymentTip | undefined): PaymentTip {
  if (tip === undefined) {
    throw new MissingTip();
  }

  assertCop(tip.amountCop);

  switch (tip.method) {
    case PAYMENT_METHOD.CARD:
      assertCardCapture(tip);
      return {
        method: PAYMENT_METHOD.CARD,
        amountCop: tip.amountCop,
        terminal: tip.terminal,
        approvalNumber: tip.approvalNumber,
        brand: tip.brand,
        last4: tip.last4,
      };
    case PAYMENT_METHOD.CASH:
    case PAYMENT_METHOD.TRANSFER:
    case PAYMENT_METHOD.WALLET:
    case PAYMENT_METHOD.VOUCHER:
    case PAYMENT_METHOD.CUSTOMER_CREDIT:
    case PAYMENT_METHOD.CORPORATE_CREDIT:
    case PAYMENT_METHOD.QR:
      return {
        method: tip.method,
        amountCop: tip.amountCop,
      };
    default: {
      const unexpected: never = tip;
      throw new Error(`Unexpected tip method: ${String(unexpected)}`);
    }
  }
}

function tenderedCop(tenders: readonly PaymentTender[]): number {
  return tenders.reduce((total, tender) => total + tender.amountCop, 0);
}

function cashTenderCop(tenders: readonly PaymentTender[]): number {
  return tenders.reduce(
    (total, tender) =>
      tender.method === PAYMENT_METHOD.CASH ? total + tender.amountCop : total,
    0,
  );
}

export class Payment {
  readonly id: string;

  readonly saleCop: number;

  readonly changeCop: number;

  private readonly recordedTenders: PaymentTender[];

  private readonly recordedTip: PaymentTip;

  private constructor(
    id: string,
    saleCop: number,
    changeCop: number,
    tenders: PaymentTender[],
    tip: PaymentTip,
  ) {
    this.id = id;
    this.saleCop = saleCop;
    this.changeCop = changeCop;
    this.recordedTenders = tenders;
    this.recordedTip = tip;
  }

  static record(input: RecordPayment): Payment {
    assertPaymentId(input.id);
    assertCop(input.accountCop);

    const tip = recordedTip(input.tip);
    const tenders = input.tenders.map((tender) => recordedTender(tender));
    const changeCop = tenderedCop(tenders) - input.accountCop;

    if (changeCop < 0) {
      throw new AccountNotCovered();
    }

    if (changeCop > cashTenderCop(tenders)) {
      throw new ChangeExceedsCash();
    }

    return new Payment(input.id, input.accountCop, changeCop, tenders, tip);
  }

  get tenders(): readonly PaymentTender[] {
    return this.recordedTenders.map((tender) => ({ ...tender }));
  }

  get tip(): PaymentTip {
    return { ...this.recordedTip };
  }
}
