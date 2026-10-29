import { InMemoryFiscalProfileRepository } from "@blackhole/invoicing/adapters/memory/in-memory-fiscal-profile-repository";
import { InMemoryTaxRuleRepository } from "@blackhole/invoicing/adapters/memory/in-memory-tax-rule-repository";
import type {
  AdoptedFiscalProfile,
  FiscalTemplate,
} from "@blackhole/invoicing/application/ports/fiscal-profile-repository";
import type { PublishedTaxRule } from "@blackhole/invoicing/application/ports/tax-rule-repository";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import { FactusSimulator } from "#src/composition/factus-simulator.js";
import {
  routePermissions,
  TaxConfigurationController,
} from "#src/http/tax-configuration.controller.js";

const tenantId = "organization_company_1";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const sessionHeader = "x-session-id";
const templateName = "SIMPLE regime, INC responsible";
const taxpayerA = "taxpayer_a";
const taxpayerB = "taxpayer_b";

const template: FiscalTemplate = {
  id: "tax_template_simple_inc",
  name: templateName,
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
    {
      rowId: "tax_row_plastic_bag",
      id: "tax_plastic_bag",
      version: 1,
      name: "plastic-bag",
      taxClassification: "plastic bag",
      fixedCop: 66,
      validFrom: "2026-01-01",
      taxes: [],
      rutResponsibilities: [],
    },
  ],
};

const vatRate = (
  version: number,
  validFrom: string,
  validTo: string,
  rate: string,
): PublishedTaxRule => ({
  tenantId,
  id: "tax_vat_5",
  version,
  name: "vat-5",
  taxClassification: "packaged drink",
  vatResponsible: true,
  validFrom,
  validTo,
  taxes: [{ code: "01", rate }],
  rutResponsibilities: [],
});

const storedVat = vatRate(1, "2026-01-01", "2026-03-31", "0.05");

const laterRate = {
  id: storedVat.id,
  name: storedVat.name,
  taxClassification: storedVat.taxClassification,
  vatResponsible: true,
  validFrom: "2026-04-01",
  validTo: "2026-12-31",
  taxes: [{ code: "01", rate: "0.19" }],
};

const storedRestaurant: PublishedTaxRule = {
  tenantId,
  id: "tax_independent_restaurant",
  version: 1,
  name: "independent-restaurant",
  taxClassification: "restaurant service",
  regime: "ordinary",
  incResponsible: true,
  franchise: false,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  taxes: [{ code: "04", rate: "0.08" }],
  rutResponsibilities: ["O-13", "O-15", "O-23", "O-47", "R-99-PN"],
};

const overlappingRate = {
  id: "tax_independent_overlap",
  name: storedRestaurant.name,
  taxClassification: storedRestaurant.taxClassification,
  regime: "ordinary" as const,
  incResponsible: true,
  franchise: false,
  validFrom: "2026-06-01",
  validTo: "2026-12-31",
  taxes: [{ code: "01", rate: "0.19" }],
  rutResponsibilities: ["R-99-PN"],
};

const forbiddenRate = {
  id: "tax_forbidden",
  name: "forbidden",
  taxClassification: "restaurant service",
  validFrom: "2026-01-01",
  taxes: [{ code: "04", rate: "0.08" }],
};

const expectedCopy = (taxpayerId: string): AdoptedFiscalProfile => ({
  tenantId,
  taxpayerId,
  id: `tax_profile_${taxpayerId}`,
  templateId: template.id,
  profile: {
    ...template.profile,
    rutResponsibilities: [...template.profile.rutResponsibilities],
    municipalities: template.profile.municipalities.map((site) => ({
      ...site,
    })),
  },
  rules: template.rules.map((entry) => ({
    ...entry,
    taxes: entry.taxes.map((tax) => ({ ...tax })),
    rutResponsibilities: [...entry.rutResponsibilities],
    rowId: `tax_copy_${taxpayerId}_${entry.rowId}`,
    templateRowId: entry.rowId,
  })),
});

class CountingFactus extends FactusSimulator {
  issues = 0;

  override async issue() {
    this.issues += 1;

    return super.issue();
  }
}

const openCloud = async (seed: {
  rules?: readonly PublishedTaxRule[];
  template?: FiscalTemplate;
}) => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const organizations = new InMemoryOrganizationRepository();
  const taxRules = new InMemoryTaxRuleRepository();
  const fiscalProfiles = new InMemoryFiscalProfileRepository();
  const factus = new CountingFactus();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [cashierId, "session_cashier"],
  ] as const;

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_owner",
        userId: ownerId,
        roleId: "owner",
        scopeKind: "company",
        scopeId: tenantId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_cashier",
        userId: cashierId,
        roleId: "cashier",
        scopeKind: "company",
        scopeId: tenantId,
        validFrom: null,
        validUntil: null,
      },
    ],
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });
  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  for (const rule of seed.rules ?? []) {
    await taxRules.insert(rule);
  }

  if (seed.template) {
    await fiscalProfiles.insertTemplate(seed.template);
  }

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(0),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(0)),
    authorizations,
    taxRules,
    fiscalProfiles,
    factus,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, organizations, taxRules, fiscalProfiles, factus };
};

type Cloud = Awaited<ReturnType<typeof openCloud>>;

const postJson = (
  application: Cloud["application"],
  url: string,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const postRule = (
  application: Cloud["application"],
  sessionId: string,
  payload: unknown,
) =>
  postJson(application, `/tenants/${tenantId}/tax-rules`, sessionId, payload);

const postAdopt = (
  application: Cloud["application"],
  sessionId: string,
  taxpayerId: string,
) =>
  postJson(
    application,
    `/tenants/${tenantId}/fiscal-profiles/adopt`,
    sessionId,
    { taxpayerId, templateName },
  );

const organizationEvents = (organizations: InMemoryOrganizationRepository) =>
  organizations.eventsFor(tenantId);

it("given a stored rate, when POST /tenants/:tenantId/tax-rules publishes the next rate, then the response is 200 and a version is inserted", async () => {
  const { application, organizations, taxRules, factus } = await openCloud({
    rules: [storedVat],
  });
  const beforeEvents = await organizationEvents(organizations);

  try {
    expect(routePermissions["POST tax-rules"]).toBe("tax.configure");
    expect(routePermissions["POST fiscal-profiles/adopt"]).toBe(
      "tax.configure",
    );
    expect(application.get(TaxConfigurationController)).toBeInstanceOf(
      TaxConfigurationController,
    );

    const response = await postRule(application, "session_owner", laterRate);
    const stored = await taxRules.list(tenantId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      vatRate(2, "2026-04-01", "2026-12-31", "0.19"),
    );
    expect(stored).toEqual([
      storedVat,
      vatRate(2, "2026-04-01", "2026-12-31", "0.19"),
    ]);
    expect(await organizationEvents(organizations)).toEqual(beforeEvents);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a stored rule, when POST /tax-rules overlaps that key, then the response is 409 and the prior version is not overwritten", async () => {
  const { application, organizations, taxRules, factus } = await openCloud({
    rules: [storedRestaurant],
  });
  const beforeEvents = await organizationEvents(organizations);

  try {
    const response = await postRule(
      application,
      "session_owner",
      overlappingRate,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "OverlappingTaxRule" });
    expect(await taxRules.list(tenantId)).toEqual([storedRestaurant]);
    expect(await organizationEvents(organizations)).toEqual(beforeEvents);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given template SIMPLE regime, INC responsible, when POST /tenants/:tenantId/fiscal-profiles/adopt assigns it, then the response is 200 and the profile and rules are copied", async () => {
  const { application, organizations, fiscalProfiles, factus } =
    await openCloud({ template });
  const beforeEvents = await organizationEvents(organizations);
  const templateBefore = await fiscalProfiles.findTemplate(templateName);

  try {
    const response = await postAdopt(application, "session_owner", taxpayerA);
    const copied = await fiscalProfiles.findAdopted(
      tenantId,
      `tax_profile_${taxpayerA}`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expectedCopy(taxpayerA));
    expect(response.json()).not.toHaveProperty("taxProfileId");
    expect(copied).toEqual(expectedCopy(taxpayerA));
    expect(copied?.id).not.toBe(template.id);
    expect(await fiscalProfiles.findTemplate(templateName)).toEqual(
      templateBefore,
    );
    expect(await organizationEvents(organizations)).toEqual(beforeEvents);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given two adopted copies, when one copy is edited, then the template and the other taxpayer stay unchanged", async () => {
  const { application, organizations, fiscalProfiles, factus } =
    await openCloud({ template });
  const beforeEvents = await organizationEvents(organizations);

  try {
    const first = await postAdopt(application, "session_owner", taxpayerA);
    const second = await postAdopt(application, "session_owner", taxpayerB);
    const templateBefore = await fiscalProfiles.findTemplate(templateName);
    const otherBefore = await fiscalProfiles.findAdopted(
      tenantId,
      `tax_profile_${taxpayerB}`,
    );
    const edited = expectedCopy(taxpayerA);
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

    await fiscalProfiles.saveAdopted(edited);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(await fiscalProfiles.findTemplate(templateName)).toEqual(
      templateBefore,
    );
    expect(
      await fiscalProfiles.findAdopted(tenantId, `tax_profile_${taxpayerB}`),
    ).toEqual(otherBefore);
    expect(
      await fiscalProfiles.findAdopted(tenantId, `tax_profile_${taxpayerA}`),
    ).toEqual(edited);
    expect(edited.id).not.toBe(template.id);
    expect(await organizationEvents(organizations)).toEqual(beforeEvents);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a cashier session without tax.configure, when POST /tax-rules and POST /fiscal-profiles/adopt are injected, then the response is 403 and nothing is saved", async () => {
  const { application, organizations, taxRules, fiscalProfiles, factus } =
    await openCloud({
      rules: [storedVat],
      template,
    });
  const beforeEvents = await organizationEvents(organizations);
  const beforeRules = await taxRules.list(tenantId);
  const templateBefore = await fiscalProfiles.findTemplate(templateName);

  try {
    const published = await postRule(
      application,
      "session_cashier",
      forbiddenRate,
    );
    const adopted = await postAdopt(application, "session_cashier", taxpayerA);

    expect(published.statusCode).toBe(403);
    expect(published.json()).toEqual({ error: "TaxConfigureDenied" });
    expect(adopted.statusCode).toBe(403);
    expect(adopted.json()).toEqual({ error: "TaxConfigureDenied" });
    expect(await taxRules.list(tenantId)).toEqual(beforeRules);
    expect(
      await fiscalProfiles.findAdopted(tenantId, `tax_profile_${taxpayerA}`),
    ).toBeUndefined();
    expect(await fiscalProfiles.findTemplate(templateName)).toEqual(
      templateBefore,
    );
    expect(await organizationEvents(organizations)).toEqual(beforeEvents);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});
