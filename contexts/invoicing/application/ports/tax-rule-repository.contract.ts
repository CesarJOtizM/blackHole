import { expect, it } from "vitest";

import type {
  PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";

const rule = (overrides: Partial<PublishedTaxRule> = {}): PublishedTaxRule => ({
  tenantId: TENANT_A,
  id: "tax_independent_restaurant",
  version: 1,
  name: "independent-restaurant",
  taxClassification: "restaurant service",
  regime: "ordinary",
  vatResponsible: false,
  incResponsible: true,
  franchise: false,
  channel: "dine-in",
  validFrom: "2026-01-01",
  validTo: "2026-03-31",
  taxes: [{ code: "04", rate: "0.08" }],
  fixedCop: 66,
  marker: "is_excluded",
  rutResponsibilities: ["O-13", "O-47"],
  ...overrides,
});

const one = (rows: readonly PublishedTaxRule[]): PublishedTaxRule => {
  const row = rows[0];

  if (row === undefined || rows.length !== 1) {
    throw new Error("Expected one tax rule.");
  }

  return row;
};

export function taxRuleRepositoryContract(
  createRepository: () => TaxRuleRepository | Promise<TaxRuleRepository>,
): void {
  it("given a tax rule, when it is inserted, then list returns an equal copy", async () => {
    const repository = await createRepository();
    const stored = rule();

    await repository.insert(stored);

    const listed = await repository.list(TENANT_A);
    expect(listed).toEqual([stored]);
    expect(listed[0]).not.toBe(stored);
    expect(listed[0]?.taxes).not.toBe(stored.taxes);
    expect(listed[0]?.taxes[0]).not.toBe(stored.taxes[0]);
    expect(listed[0]?.rutResponsibilities).not.toBe(stored.rutResponsibilities);
  });

  it("given the object returned by list, when it is mutated, then the stored rule stays unchanged", async () => {
    const repository = await createRepository();
    const stored = rule();
    await repository.insert(stored);

    const returned = one(await repository.list(TENANT_A));
    const tax = returned.taxes[0];

    if (tax === undefined) {
      throw new Error("Expected a tax component.");
    }

    returned.name = "edited-name";
    returned.validTo = "2026-12-31";
    returned.fixedCop = 100;
    tax.code = "01";
    tax.rate = "0.19";
    (returned.rutResponsibilities as string[]).push("R-99-PN");

    expect(await repository.list(TENANT_A)).toEqual([stored]);
  });

  it("given an inserted tax rule, when the inserted object is mutated, then the stored rule stays unchanged", async () => {
    const repository = await createRepository();
    const stored = rule();
    const expected = rule();
    await repository.insert(stored);
    const tax = stored.taxes[0];

    if (tax === undefined) {
      throw new Error("Expected a tax component.");
    }

    stored.name = "edited-name";
    tax.rate = "0.19";
    (stored.rutResponsibilities as string[]).push("O-15");

    expect(await repository.list(TENANT_A)).toEqual([expected]);
  });

  it("given a rule stored for tenant A, when tenant B lists and stores the same id and version, then each tenant stays hidden from the other", async () => {
    const repository = await createRepository();
    const stored = rule({
      tenantId: TENANT_A,
      taxes: [{ code: "04", rate: "0.08" }],
    });
    const other = rule({
      tenantId: TENANT_B,
      taxes: [{ code: "01", rate: "0.19" }],
    });

    await repository.insert(stored);
    await repository.insert(other);

    expect(await repository.list(TENANT_A)).toEqual([stored]);
    expect(await repository.list(TENANT_B)).toEqual([other]);
  });

  it("given version 1 of a rule, when version 2 is inserted, then both versions remain and version 1 is unchanged", async () => {
    const repository = await createRepository();
    const first = rule({
      version: 1,
      validFrom: "2026-01-01",
      validTo: "2026-03-31",
      taxes: [{ code: "01", rate: "0.05" }],
    });
    const second = rule({
      version: 2,
      validFrom: "2026-04-01",
      validTo: "2026-12-31",
      taxes: [{ code: "01", rate: "0.19" }],
    });

    await repository.insert(first);
    await repository.insert(second);

    expect(await repository.list(TENANT_A)).toEqual([first, second]);
  });

  it("given version 1 stored, when the same version is inserted with another rate, then the stored version stays unchanged", async () => {
    const repository = await createRepository();
    const first = rule({ version: 1, taxes: [{ code: "04", rate: "0.08" }] });
    const replacement = rule({
      version: 1,
      taxes: [{ code: "01", rate: "0.19" }],
    });
    await repository.insert(first);

    await expect(repository.insert(replacement)).rejects.toThrow(
      "A tax rule version already exists.",
    );

    expect(await repository.list(TENANT_A)).toEqual([first]);
  });

  it("given a tax rule repository, when the instance is inspected, then it has no update method and no delete method", async () => {
    const repository = await createRepository();

    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
}
