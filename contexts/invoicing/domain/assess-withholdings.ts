import { InvalidTaxAmount } from "#domain/calculate-taxes.js";

export class WithholdingRejected extends Error {
  constructor() {
    super("A final consumer cannot enter withholdings.");
    this.name = "WithholdingRejected";
  }
}

export type WithholdingCustomer = "withholding-agent" | "final-consumer";

export interface WithholdingInvoiceTax {
  code: string;
  rate: string;
  amount: number;
}

export interface AssessWithholdingsInput {
  customer: WithholdingCustomer;
  income: number;
  vat: number;
  ica: number;
  municipality: string;
  invoiceTaxes: readonly WithholdingInvoiceTax[];
}

export interface WithholdingAssessment {
  income: number;
  vat: number;
  ica: number;
  invoiceTaxes: readonly WithholdingInvoiceTax[];
}

const assertIntegerCop = (amount: number): void => {
  if (!Number.isInteger(amount)) {
    throw new InvalidTaxAmount();
  }
};

export const assessWithholdings = (
  input: AssessWithholdingsInput,
): WithholdingAssessment => {
  if (input.customer !== "withholding-agent") {
    throw new WithholdingRejected();
  }

  assertIntegerCop(input.income);
  assertIntegerCop(input.vat);
  assertIntegerCop(input.ica);

  return {
    income: input.income,
    vat: input.vat,
    ica: input.ica,
    invoiceTaxes: input.invoiceTaxes.map((tax) => {
      assertIntegerCop(tax.amount);

      return {
        code: tax.code,
        rate: tax.rate,
        amount: tax.amount,
      };
    }),
  };
};
