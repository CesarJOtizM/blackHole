import { CalculateTaxes as EntryCalculateTaxes } from "@blackhole/invoicing/application/entry-port";
import { expect, it } from "vitest";
import { CalculateTaxes } from "#application/calculate-taxes/calculate-taxes.js";
import {
  type AdoptedFiscalProfile,
  type CopiedFiscalRule,
  type FiscalProfileFields,
  FiscalProfileRepository,
} from "#application/ports/fiscal-profile-repository.js";
import {
  type PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";
import { NoMatchingTaxRule } from "#domain/calculate-taxes.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_other";
const PROFILE_ID = "tax_profile_taxpayer_a";

const MATCH = {
  regime: "ordinary" as const,
  vatResponsible: true,
  incResponsible: true,
  franchise: false,
};

const SALE = {
  tenantId: TENANT_ID,
  profileId: PROFILE_ID,
  lines: [{ priceCop: 10_800, taxClassification: "restaurant service" }],
  soldOn: "2026-06-15",
  channel: "take-out" as const,
  voluntaryTipCop: 1_000,
  bagCount: 2,
  deliveryBagsEnabled: false,
  paidCop: 11_932,
};

const profileFields = (
  patch: Partial<FiscalProfileFields> = {},
): FiscalProfileFields => ({
  personType: patch.personType ?? "juridical",
  regime: patch.regime ?? MATCH.regime,
  vatResponsible: patch.vatResponsible ?? MATCH.vatResponsible,
  incResponsible: patch.incResponsible ?? MATCH.incResponsible,
  franchise: patch.franchise ?? MATCH.franchise,
  rutResponsibilities: [...(patch.rutResponsibilities ?? ["O-13"])],
  municipalities: (
    patch.municipalities ?? [
      { siteId: "venue_north", municipality: "Medellin" },
    ]
  ).map((site) => ({
    siteId: site.siteId,
    municipality: site.municipality,
  })),
});

const adopted = (
  tenantId: string,
  profile: FiscalProfileFields,
  rules: readonly CopiedFiscalRule[],
): AdoptedFiscalProfile => ({
  tenantId,
  taxpayerId: "taxpayer_a",
  id: PROFILE_ID,
  templateId: "tax_template_restaurant",
  profile,
  rules,
});

const catalogRule = (
  fields: Omit<
    PublishedTaxRule,
    "tenantId" | "validFrom" | "taxes" | "rutResponsibilities"
  > &
    Partial<
      Pick<
        PublishedTaxRule,
        "tenantId" | "validFrom" | "taxes" | "rutResponsibilities"
      >
    >,
): PublishedTaxRule => ({
  ...fields,
  tenantId: fields.tenantId ?? TENANT_ID,
  validFrom: fields.validFrom ?? "2026-01-01",
  taxes: (fields.taxes ?? []).map((tax) => ({
    code: tax.code,
    rate: tax.rate,
  })),
  rutResponsibilities: [...(fields.rutResponsibilities ?? [])],
});

const COPY_DECOY: CopiedFiscalRule = {
  rowId: "tax_copy_taxpayer_a_tax_row_decoy",
  templateRowId: "tax_row_decoy",
  id: "tax_rule_copy",
  version: 1,
  name: "copy-decoy",
  taxClassification: "restaurant service",
  ...MATCH,
  channel: "take-out",
  validFrom: "2026-01-01",
  taxes: [{ code: "01", rate: "0.19" }],
  rutResponsibilities: [],
};

const CATALOG: readonly PublishedTaxRule[] = [
  catalogRule({
    tenantId: OTHER_TENANT_ID,
    id: "tax_rule_inc_8",
    version: 99,
    name: "other-tenant",
    taxClassification: "restaurant service",
    ...MATCH,
    channel: "take-out",
    taxes: [{ code: "01", rate: "0.19" }],
  }),
  catalogRule({
    id: "tax_rule_inc_8",
    version: 6,
    name: "expired-inc",
    taxClassification: "restaurant service",
    ...MATCH,
    channel: "take-out",
    validTo: "2026-03-31",
    taxes: [{ code: "01", rate: "0.19" }],
  }),
  catalogRule({
    id: "tax_rule_unscoped",
    version: 2,
    name: "unscoped",
    taxClassification: "restaurant service",
    ...MATCH,
    taxes: [{ code: "01", rate: "0.19" }],
  }),
  catalogRule({
    id: "tax_rule_inc_8",
    version: 7,
    name: "current-inc",
    taxClassification: "restaurant service",
    ...MATCH,
    channel: "take-out",
    validFrom: "2026-04-01",
    validTo: "2026-12-31",
    taxes: [{ code: "04", rate: "0.08" }],
  }),
  catalogRule({
    id: "tax_rule_bag",
    version: 4,
    name: "plastic-bag",
    taxClassification: "plastic bag",
    ...MATCH,
    fixedCop: 66,
  }),
];

const PROFILES: readonly AdoptedFiscalProfile[] = [
  adopted(
    OTHER_TENANT_ID,
    profileFields({
      regime: "simple",
      vatResponsible: true,
      incResponsible: false,
      franchise: true,
      rutResponsibilities: ["O-47"],
      municipalities: [{ siteId: "venue_south", municipality: "Bogota" }],
    }),
    [],
  ),
  adopted(TENANT_ID, profileFields({}), [COPY_DECOY]),
];

class MemoryFiscalProfiles extends FiscalProfileRepository {
  constructor(private readonly rows: readonly AdoptedFiscalProfile[]) {
    super();
  }

  override async insertTemplate(): Promise<void> {
    throw new Error("A quote cannot store a fiscal profile.");
  }

  override async findTemplate(): Promise<undefined> {
    return undefined;
  }

  override async findAdopted(
    tenantId: string,
    profileId: string,
  ): Promise<AdoptedFiscalProfile | undefined> {
    return this.rows.find(
      (row) => row.tenantId === tenantId && row.id === profileId,
    );
  }

  override async insertAdopted(): Promise<void> {
    throw new Error("A quote cannot store a fiscal profile.");
  }

  override async saveAdopted(): Promise<void> {
    throw new Error("A quote cannot store a fiscal profile.");
  }
}

class MemoryTaxRules extends TaxRuleRepository {
  constructor(private readonly rows: readonly PublishedTaxRule[]) {
    super();
  }

  override async list(tenantId: string): Promise<readonly PublishedTaxRule[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({
        ...row,
        taxes: row.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
        rutResponsibilities: [...row.rutResponsibilities],
      }));
  }

  override async insert(): Promise<void> {
    throw new Error("A quote cannot store a tax rule.");
  }
}

const quoter = (rules: readonly PublishedTaxRule[]) => ({
  quote: new CalculateTaxes(
    new MemoryFiscalProfiles(PROFILES),
    new MemoryTaxRules(rules),
  ),
});

it("given a stored profile and dated rules, when lines, a sale date, a channel, a tip, and bags are quoted, then the line and the bag return their rule id and version", async () => {
  const { quote } = quoter(CATALOG);

  const breakdown = await quote.execute(SALE);

  expect(EntryCalculateTaxes).toBe(CalculateTaxes);
  expect(breakdown).toEqual({
    lines: [
      {
        base: 10_000,
        taxes: [{ code: "04", rate: "0.08", amount: 800 }],
        excluded: false,
        ruleId: "tax_rule_inc_8",
        version: 7,
      },
    ],
    bagLine: {
      quantity: 2,
      unitCop: 66,
      amount: 132,
      code: null,
      ruleId: "tax_rule_bag",
      version: 4,
    },
    cashRoundingAmount: 0,
  });
});

it("given a stored profile and no tax rules, when the quote is calculated, then NoMatchingTaxRule is thrown", async () => {
  const { quote } = quoter([]);

  const quoteSale = quote.execute(SALE);

  await expect(quoteSale).rejects.toBeInstanceOf(NoMatchingTaxRule);
});
