import { expect, it } from "vitest";

import {
  CashRoundingRejected,
  calculateTaxes,
  NoMatchingTaxRule,
} from "#domain/calculate-taxes.js";

const INC_RULE = {
  id: "tax_rule_inc_8",
  version: 7,
  taxClassification: "restaurant service",
  taxes: [{ code: "04", rate: "0.08" }],
};

const VAT_19_RULE = {
  id: "tax_rule_vat_19",
  version: 3,
  taxClassification: "restaurant service",
  taxes: [{ code: "01", rate: "0.19" }],
};

const VAT_5_RULE = {
  id: "tax_rule_vat_5",
  version: 2,
  taxClassification: "packaged drink",
  taxes: [{ code: "01", rate: "0.05" }],
};

const TAKE_OUT_VAT = {
  id: "tax_rule_take_out",
  version: 9,
  taxClassification: "restaurant service",
  channel: "take-out" as const,
  taxes: [{ code: "01", rate: "0.19" }],
};

const DELIVERY_INC = {
  id: "tax_rule_delivery_inc",
  version: 8,
  taxClassification: "restaurant service",
  channel: "delivery" as const,
  taxes: [{ code: "04", rate: "0.08" }],
};

const DELIVERY_CHARGE = {
  id: "tax_rule_delivery_charge",
  version: 4,
  taxClassification: "delivery charge",
  taxes: [{ code: "01", rate: "0.19" }],
};

const BAG_RULE = {
  id: "tax_rule_bag",
  version: 1,
  taxClassification: "plastic bag",
  taxes: [],
  fixedCop: 66,
};

const MARCH_VAT = {
  id: "tax_rule_vat_march",
  version: 5,
  taxClassification: "packaged drink",
  taxes: [{ code: "01", rate: "0.05" }],
  validFrom: "2026-01-01",
  validTo: "2026-03-31",
};

const APRIL_VAT = {
  id: "tax_rule_vat_april",
  version: 6,
  taxClassification: "packaged drink",
  taxes: [{ code: "01", rate: "0.19" }],
  validFrom: "2026-04-01",
  validTo: "2026-12-31",
};

const NON_VAT_PROFILE = {
  regime: "ordinary" as const,
  vatResponsible: false,
  incResponsible: false,
  franchise: false,
};

const MATCH_PROFILE = {
  regime: "ordinary" as const,
  vatResponsible: true,
  incResponsible: true,
  franchise: false,
};

const line = (
  priceCop: number,
  taxClassification: string,
): { priceCop: number; taxClassification: string } => ({
  priceCop,
  taxClassification,
});

const taxed = (
  base: number,
  code: string,
  rate: string,
  amount: number,
  ruleId: string,
  version: number,
) => ({
  base,
  taxes: [{ code, rate, amount }],
  excluded: false,
  ruleId,
  version,
});

const excluded = (base: number, ruleId: string, version: number) => ({
  base,
  taxes: [],
  excluded: true,
  ruleId,
  version,
});

const PLASTIC_BAG = {
  quantity: 2,
  unitCop: 66,
  amount: 132,
  code: null,
  ruleId: BAG_RULE.id,
  version: BAG_RULE.version,
};

const profiledRule = (
  id: string,
  version: number,
  patch: {
    regime?: "ordinary" | "simple";
    vatResponsible?: boolean;
    incResponsible?: boolean;
    franchise?: boolean;
  },
  code: string,
  rate: string,
) => ({
  id,
  version,
  taxClassification: "restaurant service",
  regime: MATCH_PROFILE.regime,
  vatResponsible: MATCH_PROFILE.vatResponsible,
  incResponsible: MATCH_PROFILE.incResponsible,
  franchise: MATCH_PROFILE.franchise,
  taxes: [{ code, rate }],
  ...patch,
});

it("given an INC 8% rule, when a line priced 10800 is calculated, then the base is 10000 and INC is 800 with code 04", () => {
  const breakdown = calculateTaxes({
    rules: [INC_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_800,
  });

  expect(breakdown).toEqual({
    lines: [taxed(10_000, "04", "0.08", 800, INC_RULE.id, INC_RULE.version)],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given a VAT 19% rule, when a line priced 11900 is calculated, then the base is 10000 and VAT is 1900 with code 01", () => {
  const breakdown = calculateTaxes({
    rules: [VAT_19_RULE],
    lines: [line(11_900, "restaurant service")],
    paidCop: 11_900,
  });

  expect(breakdown).toEqual({
    lines: [
      taxed(10_000, "01", "0.19", 1_900, VAT_19_RULE.id, VAT_19_RULE.version),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given a VAT 5% rule, when a line priced 10500 is calculated, then the base is 10000 and VAT is 500", () => {
  const breakdown = calculateTaxes({
    rules: [VAT_5_RULE],
    lines: [line(10_500, "packaged drink")],
    paidCop: 10_500,
  });

  expect(breakdown).toEqual({
    lines: [
      taxed(10_000, "01", "0.05", 500, VAT_5_RULE.id, VAT_5_RULE.version),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given no rule matches the line, when the line is calculated, then NoMatchingTaxRule is thrown", () => {
  const calculate = () => {
    calculateTaxes({
      rules: [INC_RULE],
      lines: [line(10_800, "packaged drink")],
      paidCop: 10_800,
    });
  };

  expect(calculate).toThrow(NoMatchingTaxRule);
});

it("given a computed total of 10800, when the paid amount differs by more than 500 either way, then the totals are rejected", () => {
  const above = () => {
    calculateTaxes({
      rules: [INC_RULE],
      lines: [line(10_800, "restaurant service")],
      paidCop: 11_301,
    });
  };
  const below = () => {
    calculateTaxes({
      rules: [INC_RULE],
      lines: [line(10_800, "restaurant service")],
      paidCop: 10_299,
    });
  };

  expect(above).toThrow(CashRoundingRejected);
  expect(below).toThrow(CashRoundingRejected);
});

it("given a computed total of 10800, when the paid amount differs by exactly 500 either way, then the gap is accepted as cash rounding", () => {
  const above = calculateTaxes({
    rules: [INC_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 11_300,
  });
  const below = calculateTaxes({
    rules: [INC_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_300,
  });

  expect(above.cashRoundingAmount).toBe(500);
  expect(below.cashRoundingAmount).toBe(-500);
});

it("given an INC line and a VAT line, when both are calculated, then each line returns its rule id and version", () => {
  const breakdown = calculateTaxes({
    rules: [INC_RULE, VAT_5_RULE],
    lines: [line(10_800, "restaurant service"), line(10_500, "packaged drink")],
    paidCop: 21_300,
  });

  expect(breakdown.lines).toEqual([
    taxed(10_000, "04", "0.08", 800, INC_RULE.id, INC_RULE.version),
    taxed(10_000, "01", "0.05", 500, VAT_5_RULE.id, VAT_5_RULE.version),
  ]);
});

it("given an INC 8% line priced 10800, when a voluntary tip of 1000 is added, then the base stays 10000 and INC stays 800", () => {
  const breakdown = calculateTaxes({
    rules: [INC_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 11_800,
    voluntaryTipCop: 1_000,
  });

  expect(breakdown).toEqual({
    lines: [taxed(10_000, "04", "0.08", 800, INC_RULE.id, INC_RULE.version)],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given an excluded sale, when a voluntary tip of 1000 is added, then no tax is computed on the tip", () => {
  const breakdown = calculateTaxes({
    profile: NON_VAT_PROFILE,
    rules: [VAT_5_RULE],
    lines: [line(10_500, "packaged drink")],
    paidCop: 11_500,
    voluntaryTipCop: 1_000,
    channel: "dine-in",
  });

  expect(breakdown).toEqual({
    lines: [excluded(10_500, VAT_5_RULE.id, VAT_5_RULE.version)],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given a bag value of 66, when a take-out sale has 2 bags, then one bag line of 132 is produced with no DIAN code", () => {
  const breakdown = calculateTaxes({
    rules: [INC_RULE, BAG_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_932,
    channel: "take-out",
    bagCount: 2,
  });

  expect(breakdown).toEqual({
    lines: [taxed(10_000, "04", "0.08", 800, INC_RULE.id, INC_RULE.version)],
    bagLine: PLASTIC_BAG,
    cashRoundingAmount: 0,
  });
});

it("given a dine-in sale with no bags, when an unscoped rule and a take-out rule both exist, then the unscoped rule applies and no bag line is produced", () => {
  const breakdown = calculateTaxes({
    rules: [TAKE_OUT_VAT, INC_RULE, BAG_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_800,
    channel: "dine-in",
    bagCount: 0,
  });

  expect(breakdown).toEqual({
    lines: [taxed(10_000, "04", "0.08", 800, INC_RULE.id, INC_RULE.version)],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given delivery bags are disabled, when a delivery sale requests 2 bags, then the delivery rule applies and no bag line is produced", () => {
  const breakdown = calculateTaxes({
    rules: [TAKE_OUT_VAT, DELIVERY_INC, BAG_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_800,
    channel: "delivery",
    bagCount: 2,
    deliveryBagsEnabled: false,
  });

  expect(breakdown).toEqual({
    lines: [
      taxed(10_000, "04", "0.08", 800, DELIVERY_INC.id, DELIVERY_INC.version),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given delivery bags are enabled, when a delivery sale has 2 bags, then one bag line of 132 is produced with no DIAN code", () => {
  const breakdown = calculateTaxes({
    rules: [TAKE_OUT_VAT, DELIVERY_INC, BAG_RULE],
    lines: [line(10_800, "restaurant service")],
    paidCop: 10_932,
    channel: "delivery",
    bagCount: 2,
    deliveryBagsEnabled: true,
  });

  expect(breakdown).toEqual({
    lines: [
      taxed(10_000, "04", "0.08", 800, DELIVERY_INC.id, DELIVERY_INC.version),
    ],
    bagLine: PLASTIC_BAG,
    cashRoundingAmount: 0,
  });
});

it("given a 5% rule until March 31 and a 19% rule from April 1, when the same classification is sold on both dates, then March 31 uses 5% and April 1 uses 19%", () => {
  const rules = [APRIL_VAT, MARCH_VAT];
  const march = calculateTaxes({
    rules,
    lines: [line(10_500, "packaged drink")],
    paidCop: 10_500,
    soldOn: "2026-03-31",
  });
  const april = calculateTaxes({
    rules,
    lines: [line(11_900, "packaged drink")],
    paidCop: 11_900,
    soldOn: "2026-04-01",
  });

  expect(march).toEqual({
    lines: [taxed(10_000, "01", "0.05", 500, MARCH_VAT.id, MARCH_VAT.version)],
    bagLine: null,
    cashRoundingAmount: 0,
  });
  expect(april).toEqual({
    lines: [
      taxed(10_000, "01", "0.19", 1_900, APRIL_VAT.id, APRIL_VAT.version),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given a taxpayer who is not responsible for VAT, when product lines are calculated, then every product line is excluded", () => {
  const breakdown = calculateTaxes({
    profile: NON_VAT_PROFILE,
    rules: [VAT_5_RULE, VAT_19_RULE],
    lines: [line(10_500, "packaged drink"), line(11_900, "restaurant service")],
    paidCop: 22_400,
    channel: "dine-in",
  });

  expect(breakdown).toEqual({
    lines: [
      excluded(10_500, VAT_5_RULE.id, VAT_5_RULE.version),
      excluded(11_900, VAT_19_RULE.id, VAT_19_RULE.version),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given a mandatory delivery charge priced 11900, when a voluntary tip of 1000 is added, then the charge is taxed and the tip is not", () => {
  const breakdown = calculateTaxes({
    rules: [DELIVERY_CHARGE],
    lines: [line(11_900, "delivery charge")],
    paidCop: 12_900,
    voluntaryTipCop: 1_000,
    channel: "delivery",
  });

  expect(breakdown).toEqual({
    lines: [
      taxed(
        10_000,
        "01",
        "0.19",
        1_900,
        DELIVERY_CHARGE.id,
        DELIVERY_CHARGE.version,
      ),
    ],
    bagLine: null,
    cashRoundingAmount: 0,
  });
});

it("given two rules for one classification, when the profile matches regime, VAT responsibility, INC responsibility, and franchise, then that rule is applied", () => {
  const matched = profiledRule("tax_rule_match", 7, {}, "04", "0.08");
  const mismatches = [
    { regime: "simple" as const },
    { vatResponsible: false },
    { incResponsible: false },
    { franchise: true },
  ];

  for (const patch of mismatches) {
    const breakdown = calculateTaxes({
      profile: MATCH_PROFILE,
      rules: [profiledRule("tax_rule_other", 1, patch, "01", "0.19"), matched],
      lines: [line(10_800, "restaurant service")],
      paidCop: 10_800,
    });

    expect(breakdown.lines[0]).toEqual(
      taxed(10_000, "04", "0.08", 800, "tax_rule_match", 7),
    );
  }
});
