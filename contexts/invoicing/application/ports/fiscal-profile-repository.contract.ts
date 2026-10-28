import { expect, it } from "vitest";

import type {
  AdoptedFiscalProfile,
  FiscalProfileRepository,
  FiscalTemplate,
} from "#application/ports/fiscal-profile-repository.js";

const TEMPLATE_NAME = "SIMPLE regime, INC responsible";
const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";

const template = (): FiscalTemplate => ({
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
    {
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
    },
  ],
});

const adoptedFrom = (
  source: FiscalTemplate,
  tenantId: string,
  taxpayerId: string,
): AdoptedFiscalProfile => ({
  tenantId,
  taxpayerId,
  id: `tax_profile_${taxpayerId}`,
  templateId: source.id,
  profile: {
    personType: source.profile.personType,
    regime: source.profile.regime,
    vatResponsible: source.profile.vatResponsible,
    incResponsible: source.profile.incResponsible,
    franchise: source.profile.franchise,
    rutResponsibilities: [...source.profile.rutResponsibilities],
    municipalities: source.profile.municipalities.map((site) => ({
      siteId: site.siteId,
      municipality: site.municipality,
    })),
  },
  rules: source.rules.map((entry) => ({
    rowId: `tax_copy_${taxpayerId}_${entry.rowId}`,
    templateRowId: entry.rowId,
    id: entry.id,
    version: entry.version,
    name: entry.name,
    taxClassification: entry.taxClassification,
    regime: entry.regime,
    vatResponsible: entry.vatResponsible,
    incResponsible: entry.incResponsible,
    franchise: entry.franchise,
    channel: entry.channel,
    validFrom: entry.validFrom,
    validTo: entry.validTo,
    taxes: entry.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
    fixedCop: entry.fixedCop,
    marker: entry.marker,
    rutResponsibilities: [...entry.rutResponsibilities],
  })),
});

const requireTemplate = async (
  repository: FiscalProfileRepository,
): Promise<FiscalTemplate> => {
  const stored = await repository.findTemplate(TEMPLATE_NAME);

  if (stored === undefined) {
    throw new Error("Expected the fiscal template.");
  }

  return stored;
};

const requireAdopted = async (
  repository: FiscalProfileRepository,
  tenantId: string,
  profileId: string,
): Promise<AdoptedFiscalProfile> => {
  const stored = await repository.findAdopted(tenantId, profileId);

  if (stored === undefined) {
    throw new Error("Expected the adopted fiscal profile.");
  }

  return stored;
};

export function fiscalProfileRepositoryContract(
  createRepository: () =>
    | FiscalProfileRepository
    | Promise<FiscalProfileRepository>,
): void {
  it("given a fiscal template, when it is inserted, then findTemplate returns an equal copy", async () => {
    const repository = await createRepository();
    const stored = template();

    await repository.insertTemplate(stored);

    const listed = await repository.findTemplate(TEMPLATE_NAME);
    expect(listed).toEqual(stored);
    expect(listed).not.toBe(stored);
    expect(listed?.profile).not.toBe(stored.profile);
    expect(listed?.profile.municipalities).not.toBe(
      stored.profile.municipalities,
    );
    expect(listed?.profile.rutResponsibilities).not.toBe(
      stored.profile.rutResponsibilities,
    );
    expect(listed?.rules).not.toBe(stored.rules);
    expect(listed?.rules[0]).not.toBe(stored.rules[0]);
    expect(listed?.rules[0]?.taxes).not.toBe(stored.rules[0]?.taxes);
  });

  it("given the template returned by findTemplate, when it is mutated, then the stored template stays unchanged", async () => {
    const repository = await createRepository();
    const stored = template();
    await repository.insertTemplate(stored);

    const returned = await requireTemplate(repository);
    const site = returned.profile.municipalities[0];
    const entry = returned.rules[0];
    const tax = entry?.taxes[0];

    if (site === undefined || entry === undefined || tax === undefined) {
      throw new Error("Expected the template profile, rule, and tax.");
    }

    returned.name = "edited template";
    site.municipality = "Cali";
    (returned.profile.rutResponsibilities as string[]).push("O-13");
    entry.name = "edited-rule";
    tax.rate = "0.19";

    expect(await repository.findTemplate(TEMPLATE_NAME)).toEqual(stored);
  });

  it("given an inserted fiscal template, when the inserted object is mutated, then the stored template stays unchanged", async () => {
    const repository = await createRepository();
    const stored = template();
    const expected = template();
    await repository.insertTemplate(stored);
    const site = stored.profile.municipalities[0];
    const tax = stored.rules[0]?.taxes[0];

    if (site === undefined || tax === undefined) {
      throw new Error("Expected the template municipality and tax.");
    }

    stored.name = "edited template";
    site.municipality = "Cali";
    tax.rate = "0.19";

    expect(await repository.findTemplate(TEMPLATE_NAME)).toEqual(expected);
  });

  it("given an adopted profile, when it is inserted, then findAdopted returns an equal copy", async () => {
    const repository = await createRepository();
    const source = template();
    const stored = adoptedFrom(source, TENANT_A, "taxpayer_a");
    await repository.insertTemplate(source);

    await repository.insertAdopted(stored);

    const listed = await repository.findAdopted(TENANT_A, stored.id);
    expect(listed).toEqual(stored);
    expect(listed).not.toBe(stored);
    expect(listed?.profile).not.toBe(stored.profile);
    expect(listed?.profile.municipalities).not.toBe(
      stored.profile.municipalities,
    );
    expect(listed?.rules).not.toBe(stored.rules);
    expect(listed?.rules[0]).not.toBe(stored.rules[0]);
    expect(listed?.rules[0]?.taxes).not.toBe(stored.rules[0]?.taxes);
    expect(listed?.rules[0]?.templateRowId).toBe(source.rules[0]?.rowId);
  });

  it("given the profile returned by findAdopted, when it is mutated, then the stored profile stays unchanged", async () => {
    const repository = await createRepository();
    const source = template();
    const stored = adoptedFrom(source, TENANT_A, "taxpayer_a");
    await repository.insertTemplate(source);
    await repository.insertAdopted(stored);

    const returned = await requireAdopted(repository, TENANT_A, stored.id);
    const site = returned.profile.municipalities[0];
    const entry = returned.rules[0];
    const tax = entry?.taxes[0];

    if (site === undefined || entry === undefined || tax === undefined) {
      throw new Error("Expected the adopted profile, rule, and tax.");
    }

    returned.taxpayerId = "taxpayer_edited";
    site.municipality = "Cali";
    entry.rowId = "tax_row_replaced";
    tax.rate = "0.19";

    expect(await repository.findAdopted(TENANT_A, stored.id)).toEqual(stored);
  });

  it("given an inserted adopted profile, when the inserted object is mutated, then the stored profile stays unchanged", async () => {
    const repository = await createRepository();
    const source = template();
    const stored = adoptedFrom(source, TENANT_A, "taxpayer_a");
    const expected = adoptedFrom(source, TENANT_A, "taxpayer_a");
    await repository.insertTemplate(source);
    await repository.insertAdopted(stored);
    const site = stored.profile.municipalities[0];
    const tax = stored.rules[0]?.taxes[0];

    if (site === undefined || tax === undefined) {
      throw new Error("Expected the adopted municipality and tax.");
    }

    stored.taxpayerId = "taxpayer_edited";
    site.municipality = "Cali";
    tax.rate = "0.19";

    expect(await repository.findAdopted(TENANT_A, expected.id)).toEqual(
      expected,
    );
  });

  it("given an adopted profile for tenant A, when tenant B looks up that profile id, then the profile stays hidden", async () => {
    const repository = await createRepository();
    const source = template();
    const stored = adoptedFrom(source, TENANT_A, "taxpayer_a");
    const other = adoptedFrom(source, TENANT_B, "taxpayer_a");
    await repository.insertTemplate(source);
    await repository.insertAdopted(stored);

    expect(await repository.findAdopted(TENANT_B, stored.id)).toBeUndefined();

    await repository.insertAdopted(other);

    expect(await repository.findAdopted(TENANT_A, stored.id)).toEqual(stored);
    expect(await repository.findAdopted(TENANT_B, stored.id)).toEqual(other);
    expect(await repository.findTemplate(TEMPLATE_NAME)).toEqual(source);
  });

  it("given a stored template, when one taxpayer copy is edited, then that copy is not the template row and the other taxpayer stays unchanged", async () => {
    const repository = await createRepository();
    const source = template();
    const first = adoptedFrom(source, TENANT_A, "taxpayer_a");
    const second = adoptedFrom(source, TENANT_A, "taxpayer_b");
    await repository.insertTemplate(source);
    await repository.insertAdopted(first);
    await repository.insertAdopted(second);
    const edited = adoptedFrom(source, TENANT_A, "taxpayer_a");
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
    edited.rules = edited.rules.map((entry) => ({
      ...entry,
      taxes: [{ code: "01", rate: "0.19" }],
    }));

    await repository.saveAdopted(edited);

    const storedTemplate = await requireTemplate(repository);
    const storedCopy = await requireAdopted(repository, TENANT_A, edited.id);
    expect(storedTemplate).toEqual(source);
    expect(storedCopy).toEqual(edited);
    expect(storedCopy.id).not.toBe(storedTemplate.id);
    expect(storedCopy.rules[0]?.rowId).not.toBe(storedTemplate.rules[0]?.rowId);
    expect(storedCopy.rules[0]?.templateRowId).toBe(
      storedTemplate.rules[0]?.rowId,
    );
    expect(storedCopy.rules[0]).not.toBe(storedTemplate.rules[0]);
    expect(await repository.findAdopted(TENANT_A, second.id)).toEqual(second);
  });

  it("given a stored template, when a profile is inserted with the template id, then the template row stays unchanged", async () => {
    const repository = await createRepository();
    const source = template();
    const colliding = adoptedFrom(source, TENANT_A, "taxpayer_a");
    colliding.id = source.id;
    await repository.insertTemplate(source);

    await expect(repository.insertAdopted(colliding)).rejects.toThrow(
      "A copy cannot replace the template row.",
    );

    expect(await repository.findTemplate(TEMPLATE_NAME)).toEqual(source);
    expect(await repository.findAdopted(TENANT_A, source.id)).toBeUndefined();
  });
}
