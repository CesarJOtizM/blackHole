import { expect, it } from "vitest";

import {
  assessWithholdings,
  WithholdingRejected,
} from "#domain/assess-withholdings.js";

const INVOICE_TAXES = [{ code: "04", rate: "0.08", amount: 800 }];

const recorded = {
  customer: "withholding-agent" as const,
  income: 1_250,
  vat: 90,
  ica: 37,
  municipality: "Medellin",
  invoiceTaxes: INVOICE_TAXES,
};

it("given a withholding agent with recorded withholdings, when they are assessed, then income, VAT, and ICA are returned, invoice taxes stay unchanged, and nothing is stored", () => {
  const invoiceTaxes = INVOICE_TAXES.map((tax) => ({ ...tax }));

  const assessment = assessWithholdings({
    ...recorded,
    invoiceTaxes,
  });
  assessWithholdings({
    ...recorded,
    income: 1,
    vat: 1,
    ica: 1,
    invoiceTaxes,
  });

  expect(assessment).toEqual({
    income: 1_250,
    vat: 90,
    ica: 37,
    invoiceTaxes: [{ code: "04", rate: "0.08", amount: 800 }],
  });
  expect(invoiceTaxes).toEqual([{ code: "04", rate: "0.08", amount: 800 }]);
});

it("given a final consumer, when withholdings are assessed, then the assessment is rejected", () => {
  const assess = () => {
    assessWithholdings({
      ...recorded,
      customer: "final-consumer",
    });
  };

  expect(assess).toThrow(WithholdingRejected);
});

it("given a municipality that looks like a rate, when withholdings are assessed, then ICA stays the recorded amount", () => {
  const assessment = assessWithholdings({
    ...recorded,
    municipality: "0.00966",
  });

  expect(assessment.ica).toBe(37);
  expect(assessment).not.toHaveProperty("municipality");
  expect(assessment).not.toHaveProperty("rate");
});
