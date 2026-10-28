import { expect, it } from "vitest";

import { AdoptFiscalTemplate } from "#application/adopt-fiscal-template/adopt-fiscal-template.js";
import {
  type AdoptedFiscalProfile,
  FiscalProfileRepository,
  type FiscalTemplate,
  type FiscalTemplateRule,
} from "#application/ports/fiscal-profile-repository.js";

const TEMPLATE_NAME = "SIMPLE regime, INC responsible";
const TENANT_ID = "organization_tenant_1";

const rule = (fields: FiscalTemplateRule): FiscalTemplateRule => ({
  ...fields,
  taxes: fields.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...fields.rutResponsibilities],
});

const TEMPLATE: FiscalTemplate = {
  id: "tax_template_simple_inc",
  name: TEMPLATE_NAME,
  profile: {
    personType: "juridical",
    regime: "simple",
    vatResponsible: false,
    incResponsible: true,
    rutResponsibilities: ["O-47"],
    franchise: false,
    municipalities: [
      { siteId: "venue_north", municipality: "Medellin" },
      { siteId: "venue_south", municipality: "Bogota" },
    ],
  },
  rules: [
    rule({
      rowId: "tax_row_simple_inc",
      id: "tax_simple_inc",
      version: 1,
      name: "simple-inc",
      taxClassification: "restaurant service",
      regime: "simple",
      incResponsible: true,
      validFrom: "2026-01-01",
      taxes: [{ code: "O-47", rate: "0.08" }],
      rutResponsibilities: ["O-47"],
    }),
    rule({
      rowId: "tax_row_plastic_bag",
      id: "tax_plastic_bag",
      version: 1,
      name: "plastic-bag",
      taxClassification: "plastic bag",
      fixedCop: 66,
      validFrom: "2026-01-01",
      taxes: [],
      rutResponsibilities: [],
    }),
  ],
};

class MemoryFiscalProfiles extends FiscalProfileRepository {
  readonly templates: FiscalTemplate[];
  readonly adopted: AdoptedFiscalProfile[] = [];

  constructor(templates: readonly FiscalTemplate[]) {
    super();
    this.templates = [...templates];
  }

  override async insertTemplate(): Promise<void> {
    throw new Error("A fiscal template is already seeded.");
  }

  override async findTemplate(
    name: string,
  ): Promise<FiscalTemplate | undefined> {
    return this.templates.find((template) => template.name === name);
  }

  override async findAdopted(
    tenantId: string,
    profileId: string,
  ): Promise<AdoptedFiscalProfile | undefined> {
    return this.adopted.find(
      (row) => row.tenantId === tenantId && row.id === profileId,
    );
  }

  override async insertAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    if (this.templates.some((template) => template.id === profile.id)) {
      throw new Error("A copy cannot replace the template row.");
    }

    this.adopted.push(profile);
  }

  override async saveAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    const index = this.adopted.findIndex(
      (row) =>
        row.tenantId === profile.tenantId &&
        row.taxpayerId === profile.taxpayerId,
    );

    if (
      index < 0 ||
      this.templates.some((template) => template.id === profile.id)
    ) {
      throw new Error("A copy cannot replace the template row.");
    }

    this.adopted[index] = profile;
  }
}

const snapshotTemplate = (template: FiscalTemplate): FiscalTemplate => ({
  id: template.id,
  name: template.name,
  profile: {
    personType: template.profile.personType,
    regime: template.profile.regime,
    vatResponsible: template.profile.vatResponsible,
    incResponsible: template.profile.incResponsible,
    franchise: template.profile.franchise,
    rutResponsibilities: [...template.profile.rutResponsibilities],
    municipalities: template.profile.municipalities.map((site) => ({
      siteId: site.siteId,
      municipality: site.municipality,
    })),
  },
  rules: template.rules.map((entry) => rule(entry)),
});

const snapshotAdopted = (
  profile: AdoptedFiscalProfile,
): AdoptedFiscalProfile => ({
  tenantId: profile.tenantId,
  taxpayerId: profile.taxpayerId,
  id: profile.id,
  templateId: profile.templateId,
  profile: snapshotTemplate({
    id: profile.templateId,
    name: TEMPLATE_NAME,
    profile: profile.profile,
    rules: profile.rules,
  }).profile,
  rules: profile.rules.map((entry) => ({
    ...rule(entry),
    templateRowId: entry.templateRowId,
  })),
});

const expectedCopy = (taxpayerId: string): AdoptedFiscalProfile => ({
  tenantId: TENANT_ID,
  taxpayerId,
  id: `tax_profile_${taxpayerId}`,
  templateId: TEMPLATE.id,
  profile: snapshotTemplate(TEMPLATE).profile,
  rules: TEMPLATE.rules.map((entry) => ({
    ...rule(entry),
    rowId: `tax_copy_${taxpayerId}_${entry.rowId}`,
    templateRowId: entry.rowId,
  })),
});

const adopter = () => {
  const profiles = new MemoryFiscalProfiles([TEMPLATE]);

  return { profiles, adopt: new AdoptFiscalTemplate(profiles) };
};

it('given template "SIMPLE regime, INC responsible", when a taxpayer adopts it, then the profile and rules are copied onto that taxpayer', async () => {
  const { profiles, adopt } = adopter();

  const adopted = await adopt.execute({
    tenantId: TENANT_ID,
    taxpayerId: "taxpayer_a",
    templateName: TEMPLATE_NAME,
  });

  expect(adopted).toEqual(expectedCopy("taxpayer_a"));
  expect(adopted).not.toHaveProperty("taxProfileId");
  expect(profiles.adopted).toEqual([expectedCopy("taxpayer_a")]);
  expect(profiles.adopted[0]?.id).not.toBe(profiles.templates[0]?.id);
  expect(profiles.adopted[0]?.profile.municipalities).not.toBe(
    profiles.templates[0]?.profile.municipalities,
  );
  expect(profiles.adopted[0]?.profile.rutResponsibilities).not.toBe(
    profiles.templates[0]?.profile.rutResponsibilities,
  );
  expect(profiles.adopted[0]?.rules[0]).not.toBe(
    profiles.templates[0]?.rules[0],
  );
  expect(profiles.adopted[0]?.rules[0]?.taxes).not.toBe(
    profiles.templates[0]?.rules[0]?.taxes,
  );
  expect(profiles.adopted[0]?.rules.map((entry) => entry.rowId)).not.toEqual(
    profiles.templates[0]?.rules.map((entry) => entry.rowId),
  );
});

it("given two taxpayers adopted that template, when one copy is edited, then the template and the other taxpayer stay unchanged", async () => {
  const { profiles, adopt } = adopter();
  const templateBefore = snapshotTemplate(TEMPLATE);

  await adopt.execute({
    tenantId: TENANT_ID,
    taxpayerId: "taxpayer_a",
    templateName: TEMPLATE_NAME,
  });
  await adopt.execute({
    tenantId: TENANT_ID,
    taxpayerId: "taxpayer_b",
    templateName: TEMPLATE_NAME,
  });
  const storedOther = profiles.adopted.find(
    (row) => row.taxpayerId === "taxpayer_b",
  );
  const otherBefore = storedOther ? snapshotAdopted(storedOther) : undefined;
  const edited = expectedCopy("taxpayer_a");
  edited.profile = {
    ...edited.profile,
    personType: "natural",
    regime: "ordinary",
    vatResponsible: true,
    incResponsible: false,
    franchise: true,
    rutResponsibilities: ["O-13"],
    municipalities: [{ siteId: "venue_north", municipality: "Envigado" }],
  };
  edited.rules = edited.rules.map((entry) =>
    entry.id === "tax_simple_inc"
      ? { ...entry, taxes: [{ code: "01", rate: "0.19" }] }
      : entry,
  );

  await profiles.saveAdopted(edited);

  expect(snapshotTemplate(profiles.templates[0] ?? TEMPLATE)).toEqual(
    templateBefore,
  );
  expect(
    profiles.adopted.find((row) => row.taxpayerId === "taxpayer_b"),
  ).toEqual(otherBefore);
  expect(
    profiles.adopted.find((row) => row.taxpayerId === "taxpayer_a"),
  ).toEqual(edited);
  expect(edited.id).not.toBe(TEMPLATE.id);
  expect(edited.rules[0]?.rowId).not.toBe(TEMPLATE.rules[0]?.rowId);
});
