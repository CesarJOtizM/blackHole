import type {
  AdoptedFiscalProfile,
  CopiedFiscalRule,
  FiscalProfileFields,
  FiscalProfileRepository,
  FiscalTemplateRule,
} from "#application/ports/fiscal-profile-repository.js";

export class FiscalTemplateNotFound extends Error {
  constructor() {
    super("The fiscal template does not exist.");
    this.name = "FiscalTemplateNotFound";
  }
}

export interface AdoptFiscalTemplateCommand {
  tenantId: string;
  taxpayerId: string;
  templateName: string;
}

const copyProfile = (profile: FiscalProfileFields): FiscalProfileFields => ({
  personType: profile.personType,
  regime: profile.regime,
  vatResponsible: profile.vatResponsible,
  incResponsible: profile.incResponsible,
  franchise: profile.franchise,
  rutResponsibilities: [...profile.rutResponsibilities],
  municipalities: profile.municipalities.map((site) => ({
    siteId: site.siteId,
    municipality: site.municipality,
  })),
});

const copyRule = (
  rule: FiscalTemplateRule,
  taxpayerId: string,
): CopiedFiscalRule => ({
  ...rule,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...rule.rutResponsibilities],
  rowId: `tax_copy_${taxpayerId}_${rule.rowId}`,
  templateRowId: rule.rowId,
});

export class AdoptFiscalTemplate {
  constructor(private readonly profiles: FiscalProfileRepository) {}

  async execute(
    command: AdoptFiscalTemplateCommand,
  ): Promise<AdoptedFiscalProfile> {
    const template = await this.profiles.findTemplate(command.templateName);

    if (!template) {
      throw new FiscalTemplateNotFound();
    }

    const adopted: AdoptedFiscalProfile = {
      tenantId: command.tenantId,
      taxpayerId: command.taxpayerId,
      id: `tax_profile_${command.taxpayerId}`,
      templateId: template.id,
      profile: copyProfile(template.profile),
      rules: template.rules.map((rule) => copyRule(rule, command.taxpayerId)),
    };

    await this.profiles.insertAdopted(adopted);

    return adopted;
  }
}
