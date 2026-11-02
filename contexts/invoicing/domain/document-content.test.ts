import { expect, it } from "vitest";

import { calculateTaxes } from "#domain/calculate-taxes.js";
import { createDocumentContent } from "#domain/document-content.js";

const SITE_RANGE = "range_site";
const REGISTER_RANGE = "range_register";

const EXEMPT_RULE = {
  id: "tax_exempt",
  version: 1,
  taxClassification: "exempt",
  taxes: [{ code: "01", rate: "0" }],
};

const INC_RULE = {
  id: "tax_rule_inc_8",
  version: 7,
  taxClassification: "restaurant service",
  taxes: [{ code: "04", rate: "0.08" }],
};

const TAKE_OUT_RULE = {
  id: "tax_take_out",
  version: 9,
  taxClassification: "restaurant service",
  channel: "take-out" as const,
  taxes: [{ code: "01", rate: "0.19" }],
};

const BAG_RULE = {
  id: "tax_rule_bag",
  version: 1,
  taxClassification: "plastic bag",
  taxes: [],
  fixedCop: 66,
};

const EXCLUDED_RULE = {
  id: "tax_excluded",
  version: 1,
  taxClassification: "is_excluded",
  taxes: [{ code: "04", rate: "0.08" }],
  marker: "is_excluded" as const,
};

const PAYMENTS = [
  { method: "cash", amountCop: 1_000 },
  { method: "card", amountCop: 1_000 },
  { method: "transfer", amountCop: 1_000 },
  { method: "wallet", amountCop: 1_000 },
  { method: "voucher", amountCop: 1_000 },
  { method: "credit", amountCop: 1_000 },
] as const;

it("given cash, card, transfer, wallet, voucher, and credit, when the document is built, then the codes are 10, 48, 47, 47, 72, and ZZZ, credit uses form 2, and every other form is 1", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 6_000, taxClassification: "exempt" }],
    rules: [EXEMPT_RULE],
    payments: PAYMENTS,
    tipCop: 0,
    siteRangeId: SITE_RANGE,
  });

  expect(content.payments).toEqual([
    { method: "cash", code: "10", form: "1", amountCop: 1_000 },
    { method: "card", code: "48", form: "1", amountCop: 1_000 },
    { method: "transfer", code: "47", form: "1", amountCop: 1_000 },
    { method: "wallet", code: "47", form: "1", amountCop: 1_000 },
    { method: "voucher", code: "72", form: "1", amountCop: 1_000 },
    { method: "credit", code: "ZZZ", form: "2", amountCop: 1_000 },
  ]);
  expect(content.payments.map((payment) => payment.code)).not.toContain("49");
});

it("given a 100000 sale with a 10000 tip, when the document is built, then the tip is surcharge 03 propina and the taxes match the 100000 sale", () => {
  const sale = calculateTaxes({
    rules: [INC_RULE],
    lines: [{ priceCop: 100_000, taxClassification: "restaurant service" }],
    paidCop: 110_000,
    voluntaryTipCop: 10_000,
  });
  const tipInsideTheBase = calculateTaxes({
    rules: [INC_RULE],
    lines: [{ priceCop: 110_000, taxClassification: "restaurant service" }],
    paidCop: 110_000,
  });

  const content = createDocumentContent({
    lines: [{ priceCop: 100_000, taxClassification: "restaurant service" }],
    rules: [INC_RULE],
    payments: [{ method: "cash", amountCop: 110_000 }],
    tipCop: 10_000,
    siteRangeId: SITE_RANGE,
  });

  expect(content.tip).toEqual({
    code: "03",
    reason: "propina",
    amountCop: 10_000,
  });
  expect(content.lines).toEqual([
    {
      base: sale.lines[0]?.base,
      taxes: sale.lines[0]?.taxes,
      ruleId: INC_RULE.id,
      version: INC_RULE.version,
    },
  ]);
  expect(content.lines[0]?.taxes).not.toEqual(tipInsideTheBase.lines[0]?.taxes);
  expect(content.cashRoundingAmount).toBe(sale.cashRoundingAmount);
});

it("given an excluded marker, when the document is built, then the line carries no tax code", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 10_800, taxClassification: "is_excluded" }],
    rules: [EXCLUDED_RULE],
    payments: [{ method: "cash", amountCop: 10_800 }],
    tipCop: 0,
    siteRangeId: SITE_RANGE,
  });

  expect(content.lines).toEqual([
    {
      base: 10_800,
      taxes: [],
      ruleId: EXCLUDED_RULE.id,
      version: EXCLUDED_RULE.version,
    },
  ]);
});

it("given an exempt rule, when the document is built, then the line stays on code 01 at 0", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 10_000, taxClassification: "exempt" }],
    rules: [EXEMPT_RULE],
    payments: [{ method: "cash", amountCop: 10_000 }],
    tipCop: 0,
    siteRangeId: SITE_RANGE,
  });

  expect(content.lines[0]?.taxes).toEqual([
    { code: "01", rate: "0", amount: 0 },
  ]);
});

it("given a cash register range, when the document is built, then the invoice uses that range", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 10_000, taxClassification: "exempt" }],
    rules: [EXEMPT_RULE],
    payments: [{ method: "cash", amountCop: 10_000 }],
    tipCop: 0,
    siteRangeId: SITE_RANGE,
    registerRangeId: REGISTER_RANGE,
  });

  expect(content.numberingRangeId).toBe(REGISTER_RANGE);
});

it("given no cash register range, when the document is built, then the invoice uses the site range", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 10_000, taxClassification: "exempt" }],
    rules: [EXEMPT_RULE],
    payments: [{ method: "cash", amountCop: 10_000 }],
    tipCop: 0,
    siteRangeId: SITE_RANGE,
  });

  expect(content.numberingRangeId).toBe(SITE_RANGE);
});

it("given a channel rule and a bag rule, when the document is built, then there is no channel, no bag line, and no payment code 49", () => {
  const content = createDocumentContent({
    lines: [{ priceCop: 10_800, taxClassification: "restaurant service" }],
    rules: [TAKE_OUT_RULE, INC_RULE, BAG_RULE],
    payments: [{ method: "card", amountCop: 10_800 }],
    tipCop: 0,
    siteRangeId: SITE_RANGE,
  });

  expect(Object.keys(content).sort()).toEqual([
    "cashRoundingAmount",
    "lines",
    "numberingRangeId",
    "payments",
    "tip",
  ]);
  expect(content.lines[0]?.taxes).toEqual([
    { code: "04", rate: "0.08", amount: 800 },
  ]);
  expect(content.cashRoundingAmount).toBe(0);
  expect(content.payments[0]?.code).toBe("48");
  expect(JSON.stringify(content.payments)).not.toContain("49");
});
