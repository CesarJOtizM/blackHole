import type {
  FiscalProfileFields,
  FiscalProfileRepository,
} from "#application/ports/fiscal-profile-repository.js";
import type {
  PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";
import {
  calculateTaxes,
  type FiscalProfile,
  NoMatchingTaxRule,
  type TaxBreakdown,
  type TaxChannel,
  type TaxLine,
  type TaxRule,
} from "#domain/calculate-taxes.js";

export interface CalculateTaxesCommand {
  tenantId: string;
  profileId: string;
  lines: readonly TaxLine[];
  soldOn: string;
  channel: TaxChannel;
  voluntaryTipCop: number;
  bagCount: number;
  deliveryBagsEnabled: boolean;
  paidCop: number;
}

const covers = (rule: PublishedTaxRule, soldOn: string): boolean =>
  rule.validFrom <= soldOn &&
  (rule.validTo === undefined || soldOn <= rule.validTo);

const toDomainProfile = (profile: FiscalProfileFields): FiscalProfile => ({
  regime: profile.regime,
  vatResponsible: profile.vatResponsible,
  incResponsible: profile.incResponsible,
  franchise: profile.franchise,
});

const toDomainRule = (rule: PublishedTaxRule): TaxRule => ({
  id: rule.id,
  version: rule.version,
  taxClassification: rule.taxClassification,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  regime: rule.regime,
  vatResponsible: rule.vatResponsible,
  incResponsible: rule.incResponsible,
  franchise: rule.franchise,
  channel: rule.channel,
  validFrom: rule.validFrom,
  validTo: rule.validTo,
  fixedCop: rule.fixedCop,
});

export class CalculateTaxes {
  constructor(
    private readonly profiles: FiscalProfileRepository,
    private readonly rules: TaxRuleRepository,
  ) {}

  async execute(command: CalculateTaxesCommand): Promise<TaxBreakdown> {
    const adopted = await this.profiles.findAdopted(
      command.tenantId,
      command.profileId,
    );

    if (!adopted) {
      throw new NoMatchingTaxRule();
    }

    const stored = await this.rules.list(command.tenantId);

    return calculateTaxes({
      profile: toDomainProfile(adopted.profile),
      rules: stored
        .filter((rule) => covers(rule, command.soldOn))
        .map(toDomainRule),
      lines: command.lines.map((line) => ({
        priceCop: line.priceCop,
        taxClassification: line.taxClassification,
      })),
      paidCop: command.paidCop,
      soldOn: command.soldOn,
      channel: command.channel,
      bagCount: command.bagCount,
      deliveryBagsEnabled: command.deliveryBagsEnabled,
      voluntaryTipCop: command.voluntaryTipCop,
    });
  }
}
