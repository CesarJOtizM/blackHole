import {
  type AdoptedFiscalProfile,
  type CopiedFiscalRule,
  type FiscalProfileFields,
  FiscalProfileRepository,
  type FiscalTemplate,
  type FiscalTemplateRule,
} from "#application/ports/fiscal-profile-repository.js";

const cloneFields = (profile: FiscalProfileFields): FiscalProfileFields => ({
  ...profile,
  rutResponsibilities: [...profile.rutResponsibilities],
  municipalities: profile.municipalities.map((site) => ({ ...site })),
});

const cloneTemplateRule = (rule: FiscalTemplateRule): FiscalTemplateRule => ({
  ...rule,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...rule.rutResponsibilities],
});

const cloneCopiedRule = (rule: CopiedFiscalRule): CopiedFiscalRule => ({
  ...rule,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...rule.rutResponsibilities],
});

const cloneTemplate = (template: FiscalTemplate): FiscalTemplate => ({
  ...template,
  profile: cloneFields(template.profile),
  rules: template.rules.map(cloneTemplateRule),
});

const cloneAdopted = (profile: AdoptedFiscalProfile): AdoptedFiscalProfile => ({
  ...profile,
  profile: cloneFields(profile.profile),
  rules: profile.rules.map(cloneCopiedRule),
});

const sameTemplateRow = (
  templates: readonly FiscalTemplate[],
  profileId: string,
): boolean => templates.some((template) => template.id === profileId);

export class InMemoryFiscalProfileRepository extends FiscalProfileRepository {
  private readonly templates: FiscalTemplate[] = [];
  private readonly adopted: AdoptedFiscalProfile[] = [];

  override async insertTemplate(template: FiscalTemplate): Promise<void> {
    const duplicate = this.templates.some(
      (row) => row.id === template.id || row.name === template.name,
    );

    if (duplicate) {
      throw new Error("A fiscal template already exists.");
    }

    this.templates.push(cloneTemplate(template));
  }

  override async findTemplate(
    name: string,
  ): Promise<FiscalTemplate | undefined> {
    const template = this.templates.find((row) => row.name === name);

    return template === undefined ? undefined : cloneTemplate(template);
  }

  override async findAdopted(
    tenantId: string,
    profileId: string,
  ): Promise<AdoptedFiscalProfile | undefined> {
    const profile = this.adopted.find(
      (row) => row.tenantId === tenantId && row.id === profileId,
    );

    return profile === undefined ? undefined : cloneAdopted(profile);
  }

  override async insertAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    if (sameTemplateRow(this.templates, profile.id)) {
      throw new Error("A copy cannot replace the template row.");
    }

    const duplicate = this.adopted.some(
      (row) => row.tenantId === profile.tenantId && row.id === profile.id,
    );

    if (duplicate) {
      throw new Error("An adopted fiscal profile already exists.");
    }

    this.adopted.push(cloneAdopted(profile));
  }

  override async saveAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    if (sameTemplateRow(this.templates, profile.id)) {
      throw new Error("A copy cannot replace the template row.");
    }

    const index = this.adopted.findIndex(
      (row) =>
        row.tenantId === profile.tenantId &&
        row.taxpayerId === profile.taxpayerId,
    );

    if (index < 0) {
      throw new Error("A copy cannot replace the template row.");
    }

    this.adopted[index] = cloneAdopted(profile);
  }
}
