import { expect, it } from "vitest";

import {
  type PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";
import {
  OverlappingTaxRule,
  PublishTaxRule,
} from "#application/publish-tax-rule/publish-tax-rule.js";

const TENANT_ID = "organization_tenant_1";
const RUT_CODES = ["O-13", "O-15", "O-23", "O-47", "R-99-PN"] as const;
const ULTRA_PROCESSED_RATE = "0.15";

interface CatalogRule {
  tenantId: string;
  id: string;
  name: string;
  taxClassification: string;
  regime?: "ordinary" | "simple";
  vatResponsible?: boolean;
  incResponsible?: boolean;
  franchise?: boolean;
  validFrom: string;
  validTo?: string;
  taxes: readonly { code: string; rate: string }[];
  fixedCop?: number;
  marker?: "is_excluded" | "not_taxed";
  rutResponsibilities?: readonly string[];
}

class MemoryTaxRules extends TaxRuleRepository {
  readonly rows: PublishedTaxRule[] = [];

  override async list(tenantId: string): Promise<readonly PublishedTaxRule[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({
        ...row,
        taxes: row.taxes.map((tax) => ({ ...tax })),
        rutResponsibilities: [...row.rutResponsibilities],
      }));
  }

  override async insert(rule: PublishedTaxRule): Promise<void> {
    const duplicate = this.rows.some(
      (row) =>
        row.tenantId === rule.tenantId &&
        row.id === rule.id &&
        row.version === rule.version,
    );

    if (duplicate) {
      throw new Error("A tax rule version already exists.");
    }

    this.rows.push({
      ...rule,
      taxes: rule.taxes.map((tax) => ({ ...tax })),
      rutResponsibilities: [...rule.rutResponsibilities],
    });
  }
}

const draft = (
  fields: Omit<CatalogRule, "tenantId" | "validFrom" | "taxes"> &
    Partial<Pick<CatalogRule, "validFrom" | "taxes">>,
): CatalogRule => ({
  tenantId: TENANT_ID,
  validFrom: "2026-01-01",
  taxes: [],
  ...fields,
});

const storedFrom = (rule: CatalogRule, version: number): PublishedTaxRule => ({
  ...rule,
  version,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...(rule.rutResponsibilities ?? [])],
});

const CATALOG: readonly CatalogRule[] = [
  draft({
    id: "tax_independent_restaurant",
    name: "independent-restaurant",
    taxClassification: "restaurant service",
    regime: "ordinary",
    incResponsible: true,
    franchise: false,
    taxes: [{ code: "04", rate: "0.08" }],
    rutResponsibilities: RUT_CODES,
  }),
  draft({
    id: "tax_franchise",
    name: "franchise",
    taxClassification: "restaurant service",
    franchise: true,
    vatResponsible: true,
    taxes: [{ code: "01", rate: "0.19" }],
  }),
  draft({
    id: "tax_simple_inc",
    name: "simple-inc",
    taxClassification: "restaurant service",
    regime: "simple",
    incResponsible: true,
    taxes: [{ code: "O-47", rate: "0.08" }],
  }),
  draft({
    id: "tax_vat_5",
    name: "vat-5",
    taxClassification: "packaged drink",
    vatResponsible: true,
    taxes: [{ code: "01", rate: "0.05" }],
  }),
  draft({
    id: "tax_exempt",
    name: "exempt",
    taxClassification: "exempt",
    taxes: [{ code: "01", rate: "0" }],
  }),
  draft({
    id: "tax_excluded",
    name: "is_excluded",
    taxClassification: "is_excluded",
    marker: "is_excluded",
  }),
  draft({
    id: "tax_not_taxed",
    name: "not_taxed",
    taxClassification: "not_taxed",
    marker: "not_taxed",
  }),
  draft({
    id: "tax_ultra_processed",
    name: "ultra-processed",
    taxClassification: "ultra-processed",
    taxes: [{ code: "35", rate: ULTRA_PROCESSED_RATE }],
  }),
  draft({
    id: "tax_plastic_bag",
    name: "plastic-bag",
    taxClassification: "plastic bag",
    fixedCop: 66,
  }),
];

const publisher = () => {
  const rules = new MemoryTaxRules();

  return { rules, publish: new PublishTaxRule(rules) };
};

it("given the tax catalog, when each named rule is published, then it is stored and the RUT codes are stored only", async () => {
  const { rules, publish } = publisher();

  for (const entry of CATALOG) {
    await publish.execute(entry);
  }

  expect(rules.rows).toEqual(CATALOG.map((entry) => storedFrom(entry, 1)));
  expect(
    rules.rows.find((row) => row.name === "independent-restaurant")?.taxes,
  ).toEqual([{ code: "04", rate: "0.08" }]);
  expect(rules.rows.find((row) => row.name === "simple-inc")?.taxes).toEqual([
    { code: "O-47", rate: "0.08" },
  ]);
  expect(
    rules.rows.find((row) => row.name === "independent-restaurant")
      ?.rutResponsibilities,
  ).toEqual([...RUT_CODES]);
});

it("given a stored rule, when a new rate overlaps the same key, then nothing is saved and the old rate remains", async () => {
  const { rules, publish } = publisher();
  const stored = draft({
    id: "tax_independent_restaurant",
    name: "independent-restaurant",
    taxClassification: "restaurant service",
    regime: "ordinary",
    incResponsible: true,
    franchise: false,
    validTo: "2026-12-31",
    taxes: [{ code: "04", rate: "0.08" }],
    rutResponsibilities: RUT_CODES,
  });
  const overlapping = {
    ...stored,
    id: "tax_independent_overlap",
    validFrom: "2026-06-01",
    taxes: [{ code: "01", rate: "0.19" }],
    rutResponsibilities: ["R-99-PN"],
  };

  await publish.execute(stored);

  await expect(publish.execute(overlapping)).rejects.toBeInstanceOf(
    OverlappingTaxRule,
  );
  expect(rules.rows).toEqual([storedFrom(stored, 1)]);
});

it("given a stored rate, when a new rate starts after it ends, then a version is inserted and the old rate remains", async () => {
  const { rules, publish } = publisher();
  const stored = draft({
    id: "tax_vat_5",
    name: "vat-5",
    taxClassification: "packaged drink",
    vatResponsible: true,
    validTo: "2026-03-31",
    taxes: [{ code: "01", rate: "0.05" }],
  });
  const later = {
    ...stored,
    validFrom: "2026-04-01",
    validTo: "2026-12-31",
    taxes: [{ code: "01", rate: "0.19" }],
  };

  await publish.execute(stored);

  await publish.execute(later);

  expect(rules.rows).toEqual([storedFrom(stored, 1), storedFrom(later, 2)]);
});
