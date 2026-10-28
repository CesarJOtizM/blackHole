import type {
  PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";

const OPEN_ENDED = "9999-12-31";

export class OverlappingTaxRule extends Error {
  constructor() {
    super("A tax rule overlaps an existing rule on the same key.");
    this.name = "OverlappingTaxRule";
  }
}

export type PublishTaxRuleCommand = Omit<
  PublishedTaxRule,
  "version" | "rutResponsibilities"
> & {
  rutResponsibilities?: readonly string[];
};

interface DatedRule {
  validFrom: string;
  validTo?: string;
}

const sameKey = (left: PublishedTaxRule, right: PublishedTaxRule): boolean =>
  left.regime === right.regime &&
  left.vatResponsible === right.vatResponsible &&
  left.incResponsible === right.incResponsible &&
  left.franchise === right.franchise &&
  left.taxClassification === right.taxClassification &&
  left.channel === right.channel;

const rangesOverlap = (left: DatedRule, right: DatedRule): boolean => {
  const leftTo = left.validTo ?? OPEN_ENDED;
  const rightTo = right.validTo ?? OPEN_ENDED;

  return left.validFrom <= rightTo && right.validFrom <= leftTo;
};

const nextVersion = (rules: readonly PublishedTaxRule[], id: string): number =>
  rules.reduce(
    (max, rule) => (rule.id === id ? Math.max(max, rule.version) : max),
    0,
  ) + 1;

const toRule = (
  command: PublishTaxRuleCommand,
  version: number,
): PublishedTaxRule => ({
  ...command,
  version,
  taxes: command.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...(command.rutResponsibilities ?? [])],
});

export class PublishTaxRule {
  constructor(private readonly rules: TaxRuleRepository) {}

  async execute(command: PublishTaxRuleCommand): Promise<PublishedTaxRule> {
    const stored = await this.rules.list(command.tenantId);
    const candidate = toRule(command, nextVersion(stored, command.id));
    const overlaps = stored.some(
      (rule) => sameKey(rule, candidate) && rangesOverlap(rule, candidate),
    );

    if (overlaps) {
      throw new OverlappingTaxRule();
    }

    await this.rules.insert(candidate);

    return candidate;
  }
}
