import { Decimal } from "decimal.js";

const TAX_ID_PREFIX = "tax_";
const CASH_ROUNDING_LIMIT = 500;

export class InvalidTaxId extends Error {
  constructor() {
    super("A tax identifier must use the tax_ prefix.");
    this.name = "InvalidTaxId";
  }
}

export class InvalidTaxAmount extends Error {
  constructor() {
    super("Tax amounts must be integer COP.");
    this.name = "InvalidTaxAmount";
  }
}

export class NoMatchingTaxRule extends Error {
  constructor() {
    super("No tax rule matches the line.");
    this.name = "NoMatchingTaxRule";
  }
}

export class CashRoundingRejected extends Error {
  constructor() {
    super("The cash rounding gap is past ±500.");
    this.name = "CashRoundingRejected";
  }
}

export type TaxRegime = "ordinary" | "simple";

export type TaxChannel = "dine-in" | "take-out" | "delivery";

export interface FiscalProfile {
  regime: TaxRegime;
  vatResponsible: boolean;
  incResponsible: boolean;
  franchise: boolean;
}

export interface TaxComponent {
  code: string;
  rate: string;
}

export interface TaxRule {
  id: string;
  version: number;
  taxClassification: string;
  taxes: readonly TaxComponent[];
  regime?: TaxRegime;
  vatResponsible?: boolean;
  incResponsible?: boolean;
  franchise?: boolean;
  channel?: TaxChannel;
  validFrom?: string;
  validTo?: string;
  fixedCop?: number;
}

export interface TaxLine {
  priceCop: number;
  taxClassification: string;
}

export interface CalculateTaxesInput {
  profile?: FiscalProfile;
  rules: readonly TaxRule[];
  lines: readonly TaxLine[];
  paidCop: number;
  soldOn?: string;
  channel?: TaxChannel;
  bagCount?: number;
  deliveryBagsEnabled?: boolean;
  voluntaryTipCop?: number;
}

export interface TaxAmount {
  code: string;
  rate: string;
  amount: number;
}

export interface TaxedLine {
  base: number;
  taxes: readonly TaxAmount[];
  excluded: boolean;
  ruleId: string;
  version: number;
}

export interface BagLine {
  quantity: number;
  unitCop: number;
  amount: number;
  code: null;
  ruleId: string;
  version: number;
}

export interface TaxBreakdown {
  lines: readonly TaxedLine[];
  bagLine: BagLine | null;
  cashRoundingAmount: number;
}

interface PricedLine {
  line: TaxedLine;
  total: Decimal;
}

interface MatchContext {
  profile?: FiscalProfile;
  soldOn?: string;
  channel?: TaxChannel;
}

const money = (value: Decimal): Decimal =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

const pesos = (value: Decimal): Decimal =>
  value.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);

const assertTaxId = (id: string): void => {
  if (!id.startsWith(TAX_ID_PREFIX) || id.length === TAX_ID_PREFIX.length) {
    throw new InvalidTaxId();
  }
};

const assertIntegerCop = (amount: number): void => {
  if (!Number.isInteger(amount)) {
    throw new InvalidTaxAmount();
  }
};

const sameKey = <T>(ruleValue: T | undefined, actual: T | undefined): boolean =>
  ruleValue === undefined || ruleValue === actual;

const matchesProfile = (
  rule: TaxRule,
  profile: FiscalProfile | undefined,
): boolean =>
  sameKey(rule.regime, profile?.regime) &&
  sameKey(rule.vatResponsible, profile?.vatResponsible) &&
  sameKey(rule.incResponsible, profile?.incResponsible) &&
  sameKey(rule.franchise, profile?.franchise);

const matchesChannel = (
  rule: TaxRule,
  channel: TaxChannel | undefined,
): boolean => rule.channel === undefined || rule.channel === channel;

const matchesDate = (rule: TaxRule, soldOn: string | undefined): boolean => {
  if (rule.validFrom === undefined && rule.validTo === undefined) {
    return true;
  }

  if (
    soldOn === undefined ||
    (rule.validFrom !== undefined && soldOn < rule.validFrom) ||
    (rule.validTo !== undefined && soldOn > rule.validTo)
  ) {
    return false;
  }

  return true;
};

const matchesContext = (rule: TaxRule, context: MatchContext): boolean =>
  matchesProfile(rule, context.profile) &&
  matchesChannel(rule, context.channel) &&
  matchesDate(rule, context.soldOn);

const specificity = (rule: TaxRule): number =>
  rule.channel === undefined ? 0 : 1;

const selectRule = (
  rules: readonly TaxRule[],
  predicate: (rule: TaxRule) => boolean,
): TaxRule | undefined =>
  rules
    .filter(predicate)
    .sort((left, right) => specificity(right) - specificity(left))[0];

const ruleFor = (
  rules: readonly TaxRule[],
  taxClassification: string,
  context: MatchContext,
): TaxRule => {
  const rule = selectRule(
    rules,
    (candidate) =>
      candidate.fixedCop === undefined &&
      candidate.taxClassification === taxClassification &&
      matchesContext(candidate, context),
  );

  if (!rule) {
    throw new NoMatchingTaxRule();
  }

  assertTaxId(rule.id);

  return rule;
};

const priceLine = (priceCop: number, rule: TaxRule): PricedLine => {
  assertIntegerCop(priceCop);

  const rateSum = rule.taxes.reduce(
    (sum, tax) => sum.plus(tax.rate),
    new Decimal(0),
  );
  const base = money(new Decimal(priceCop).div(new Decimal(1).plus(rateSum)));
  const taxes: TaxAmount[] = [];
  let total = base;

  for (const tax of rule.taxes) {
    const amount = money(new Decimal(tax.rate).mul(base));
    total = total.plus(amount);
    taxes.push({
      code: tax.code,
      rate: tax.rate,
      amount: amount.toNumber(),
    });
  }

  return {
    line: {
      base: base.toNumber(),
      taxes,
      excluded: false,
      ruleId: rule.id,
      version: rule.version,
    },
    total,
  };
};

const excludedLine = (priceCop: number, rule: TaxRule): PricedLine => {
  assertIntegerCop(priceCop);

  return {
    line: {
      base: priceCop,
      taxes: [],
      excluded: true,
      ruleId: rule.id,
      version: rule.version,
    },
    total: new Decimal(priceCop),
  };
};

const bagsCharged = (
  channel: TaxChannel | undefined,
  bagCount: number,
  deliveryBagsEnabled: boolean,
  vatResponsible: boolean | undefined,
): boolean => {
  if (vatResponsible === false || bagCount <= 0) {
    return false;
  }

  if (channel === "take-out") {
    return true;
  }

  return channel === "delivery" && deliveryBagsEnabled;
};

const bagLineFor = (
  rules: readonly TaxRule[],
  context: MatchContext,
  bagCount: number,
  deliveryBagsEnabled: boolean,
): BagLine | null => {
  if (
    !bagsCharged(
      context.channel,
      bagCount,
      deliveryBagsEnabled,
      context.profile?.vatResponsible,
    )
  ) {
    return null;
  }

  const rule = selectRule(
    rules,
    (candidate) =>
      candidate.fixedCop !== undefined && matchesContext(candidate, context),
  );

  if (!rule || rule.fixedCop === undefined) {
    throw new NoMatchingTaxRule();
  }

  assertTaxId(rule.id);
  assertIntegerCop(rule.fixedCop);

  const amount = pesos(new Decimal(rule.fixedCop).mul(bagCount));

  return {
    quantity: bagCount,
    unitCop: rule.fixedCop,
    amount: amount.toNumber(),
    code: null,
    ruleId: rule.id,
    version: rule.version,
  };
};

export const calculateTaxes = (input: CalculateTaxesInput): TaxBreakdown => {
  assertIntegerCop(input.paidCop);
  const tip = input.voluntaryTipCop ?? 0;
  assertIntegerCop(tip);
  const bagCount = input.bagCount ?? 0;
  assertIntegerCop(bagCount);
  const context: MatchContext = {
    profile: input.profile,
    soldOn: input.soldOn,
    channel: input.channel,
  };

  let computed = new Decimal(0);
  const lines = input.lines.map((line) => {
    const rule = ruleFor(input.rules, line.taxClassification, context);
    const priced =
      input.profile?.vatResponsible === false
        ? excludedLine(line.priceCop, rule)
        : priceLine(line.priceCop, rule);
    computed = computed.plus(priced.total);

    return priced.line;
  });
  const bagLine = bagLineFor(
    input.rules,
    context,
    bagCount,
    input.deliveryBagsEnabled ?? false,
  );

  if (bagLine) {
    computed = computed.plus(bagLine.amount);
  }

  const gap = new Decimal(input.paidCop).minus(tip).minus(pesos(computed));

  if (gap.abs().greaterThan(CASH_ROUNDING_LIMIT)) {
    throw new CashRoundingRejected();
  }

  return {
    lines,
    bagLine,
    cashRoundingAmount: gap.toNumber(),
  };
};
