import {
  calculateTaxes,
  type TaxAmount,
  type TaxedLine,
  type TaxLine,
  type TaxRule,
} from "#domain/calculate-taxes.js";

const DOCUMENT_PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
  WALLET: "wallet",
  VOUCHER: "voucher",
  CREDIT: "credit",
} as const;

const PAYMENT_CODE = {
  cash: "10",
  card: "48",
  transfer: "47",
  wallet: "47",
  voucher: "72",
  credit: "ZZZ",
} as const;

const PAYMENT_FORM = {
  COUNTED: "1",
  CREDIT: "2",
} as const;

const TIP_SURCHARGE = {
  CODE: "03",
  REASON: "propina",
} as const;

const DOCUMENT_TAX_MARKER = {
  EXCLUDED: "is_excluded",
} as const;

export type DocumentPaymentMethod =
  (typeof DOCUMENT_PAYMENT_METHOD)[keyof typeof DOCUMENT_PAYMENT_METHOD];

export type DocumentPaymentCode = (typeof PAYMENT_CODE)[DocumentPaymentMethod];

export type PaymentForm = (typeof PAYMENT_FORM)[keyof typeof PAYMENT_FORM];

export type DocumentTaxMarker =
  (typeof DOCUMENT_TAX_MARKER)[keyof typeof DOCUMENT_TAX_MARKER];

export interface DocumentPayment {
  method: DocumentPaymentMethod;
  amountCop: number;
}

export interface DocumentTaxRule extends TaxRule {
  marker?: DocumentTaxMarker;
}

export interface DocumentTax {
  code: string;
  rate: string;
  amount: number;
}

export interface DocumentLine {
  base: number;
  taxes: readonly DocumentTax[];
  ruleId: string;
  version: number;
}

export interface DocumentContentPayment {
  method: DocumentPaymentMethod;
  code: DocumentPaymentCode;
  form: PaymentForm;
  amountCop: number;
}

export interface DocumentTip {
  code: (typeof TIP_SURCHARGE)["CODE"];
  reason: (typeof TIP_SURCHARGE)["REASON"];
  amountCop: number;
}

export interface DocumentContent {
  numberingRangeId: string;
  lines: readonly DocumentLine[];
  payments: readonly DocumentContentPayment[];
  tip: DocumentTip | null;
  cashRoundingAmount: number;
}

export interface CreateDocumentContent {
  lines: readonly TaxLine[];
  rules: readonly DocumentTaxRule[];
  payments: readonly DocumentPayment[];
  tipCop: number;
  siteRangeId: string;
  registerRangeId?: string;
}

const paidCop = (payments: readonly DocumentPayment[]): number =>
  payments.reduce((sum, payment) => sum + payment.amountCop, 0);

const rulesForTaxes = (rules: readonly DocumentTaxRule[]): TaxRule[] =>
  rules.map((rule) => {
    const { marker, ...taxRule } = rule;

    if (marker === DOCUMENT_TAX_MARKER.EXCLUDED) {
      return { ...taxRule, taxes: [] };
    }

    return taxRule;
  });

const documentTax = (tax: TaxAmount): DocumentTax => ({
  code: tax.code,
  rate: tax.rate,
  amount: tax.amount,
});

const documentLine = (line: TaxedLine): DocumentLine => ({
  base: line.base,
  taxes: line.excluded ? [] : line.taxes.map(documentTax),
  ruleId: line.ruleId,
  version: line.version,
});

const paymentForm = (method: DocumentPaymentMethod): PaymentForm => {
  if (method === DOCUMENT_PAYMENT_METHOD.CREDIT) {
    return PAYMENT_FORM.CREDIT;
  }

  return PAYMENT_FORM.COUNTED;
};

const documentPayment = (payment: DocumentPayment): DocumentContentPayment => ({
  method: payment.method,
  code: PAYMENT_CODE[payment.method],
  form: paymentForm(payment.method),
  amountCop: payment.amountCop,
});

const tipSurcharge = (tipCop: number): DocumentTip | null => {
  if (tipCop === 0) {
    return null;
  }

  return {
    code: TIP_SURCHARGE.CODE,
    reason: TIP_SURCHARGE.REASON,
    amountCop: tipCop,
  };
};

export const createDocumentContent = (
  input: CreateDocumentContent,
): DocumentContent => {
  const breakdown = calculateTaxes({
    rules: rulesForTaxes(input.rules),
    lines: input.lines,
    paidCop: paidCop(input.payments),
    voluntaryTipCop: input.tipCop,
  });

  return {
    numberingRangeId: input.registerRangeId ?? input.siteRangeId,
    lines: breakdown.lines.map(documentLine),
    payments: input.payments.map(documentPayment),
    tip: tipSurcharge(input.tipCop),
    cashRoundingAmount: breakdown.cashRoundingAmount,
  };
};
