import { InvalidCashAmount } from "#domain/cash-shift.js";

const REFERENCE_PREFIX = "qrpay_";

const QR_INSTRUMENT = {
  CARD: "card",
  NEQUI: "nequi",
  DAVIPLATA: "daviplata",
  BRE_B: "bre-b",
} as const;

const CONFIRMED_STATUS = {
  CONFIRMED: "confirmed",
  PENDING_APPLICATION: "pending_application",
  APPLIED: "applied",
} as const;

export type QrInstrument = (typeof QR_INSTRUMENT)[keyof typeof QR_INSTRUMENT];

export type QrPaymentStatus =
  | "started"
  | (typeof CONFIRMED_STATUS)[keyof typeof CONFIRMED_STATUS];

export type QrInvoiceMethod = "card" | "transfer";

export interface StartQrCharge {
  reference: string;
  checkId: string;
  partId: string | null;
  balanceCop: number;
  tipCop: number;
  startedAt: number;
}

export interface ConfirmQrCharge {
  reference: string;
  amountCop: number;
  instrument: QrInstrument;
}

export class InvalidQrReference extends Error {
  constructor() {
    super("A QR charge reference must use the qrpay_ prefix.");
    this.name = "InvalidQrReference";
  }
}

export class QrPaymentNotConfirmed extends Error {
  constructor() {
    super("A started charge is not a confirmed QR payment.");
    this.name = "QrPaymentNotConfirmed";
  }
}

const assertCop = (amount: number): void => {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidCashAmount();
  }
};

const assertReference = (reference: string): void => {
  if (
    !reference.startsWith(REFERENCE_PREFIX) ||
    reference.length === REFERENCE_PREFIX.length
  ) {
    throw new InvalidQrReference();
  }
};

function assertInstrument(
  instrument: string,
): asserts instrument is QrInstrument {
  switch (instrument) {
    case QR_INSTRUMENT.CARD:
    case QR_INSTRUMENT.NEQUI:
    case QR_INSTRUMENT.DAVIPLATA:
    case QR_INSTRUMENT.BRE_B:
      return;
    default:
      throw new QrPaymentNotConfirmed();
  }
}

const invoiceMethodOf = (instrument: QrInstrument): QrInvoiceMethod =>
  instrument === QR_INSTRUMENT.CARD ? "card" : "transfer";

export class QrPaymentConfirmed {
  readonly reference: string;

  readonly checkId: string;

  readonly partId: string | null;

  readonly balanceCop: number;

  readonly tipCop: number;

  readonly amountCop: number;

  readonly instrument: QrInstrument;

  readonly startedAt: number;

  private statusValue: Exclude<QrPaymentStatus, "started"> =
    CONFIRMED_STATUS.CONFIRMED;

  private constructor(started: QrPayment, instrument: QrInstrument) {
    this.reference = started.reference;
    this.checkId = started.checkId;
    this.partId = started.partId;
    this.balanceCop = started.balanceCop;
    this.tipCop = started.tipCop;
    this.amountCop = started.amountCop;
    this.instrument = instrument;
    this.startedAt = started.startedAt;
  }

  static fromStarted(
    started: QrPayment,
    instrument: QrInstrument,
  ): QrPaymentConfirmed {
    return new QrPaymentConfirmed(started, instrument);
  }

  get status(): Exclude<QrPaymentStatus, "started"> {
    return this.statusValue;
  }

  get invoiceMethod(): QrInvoiceMethod {
    return invoiceMethodOf(this.instrument);
  }

  markPendingApplication(): void {
    if (this.statusValue === CONFIRMED_STATUS.APPLIED) {
      return;
    }

    this.statusValue = CONFIRMED_STATUS.PENDING_APPLICATION;
  }

  markApplied(): void {
    this.statusValue = CONFIRMED_STATUS.APPLIED;
  }
}

export class QrPayment {
  readonly status = "started" as const;

  readonly reference: string;

  readonly checkId: string;

  readonly partId: string | null;

  readonly balanceCop: number;

  readonly tipCop: number;

  readonly amountCop: number;

  readonly startedAt: number;

  private constructor(
    reference: string,
    checkId: string,
    partId: string | null,
    balanceCop: number,
    tipCop: number,
    startedAt: number,
  ) {
    this.reference = reference;
    this.checkId = checkId;
    this.partId = partId;
    this.balanceCop = balanceCop;
    this.tipCop = tipCop;
    this.amountCop = balanceCop + tipCop;
    this.startedAt = startedAt;
  }

  static start(input: StartQrCharge): QrPayment {
    assertReference(input.reference);
    assertCop(input.balanceCop);
    assertCop(input.tipCop);

    if (!Number.isInteger(input.startedAt) || input.startedAt < 0) {
      throw new InvalidCashAmount();
    }

    return new QrPayment(
      input.reference,
      input.checkId,
      input.partId,
      input.balanceCop,
      input.tipCop,
      input.startedAt,
    );
  }

  confirm(input: ConfirmQrCharge): QrPaymentConfirmed {
    assertReference(input.reference);
    assertCop(input.amountCop);
    assertInstrument(input.instrument);

    if (
      input.reference !== this.reference ||
      input.amountCop !== this.amountCop
    ) {
      throw new QrPaymentNotConfirmed();
    }

    return QrPaymentConfirmed.fromStarted(this, input.instrument);
  }
}
