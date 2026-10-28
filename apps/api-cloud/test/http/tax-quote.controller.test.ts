import { InMemoryFiscalProfileRepository } from "@blackhole/invoicing/adapters/memory/in-memory-fiscal-profile-repository";
import { InMemoryTaxRuleRepository } from "@blackhole/invoicing/adapters/memory/in-memory-tax-rule-repository";
import type { AdoptedFiscalProfile } from "@blackhole/invoicing/application/ports/fiscal-profile-repository";
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
  TaxQuoteController,
} from "#src/http/tax-quote.controller.js";

const tenantId = "organization_company_1";
const profileId = "tax_profile_taxpayer_a";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const sessionHeader = "x-session-id";

const quoteBody = {
  profileId,
  lines: [{ priceCop: 10_800, taxClassification: "restaurant service" }],
  soldOn: "2026-06-15",
  channel: "dine-in",
  voluntaryTipCop: 0,
  bagCount: 0,
  deliveryBagsEnabled: false,
  paidCop: 10_800,
};

const incRule: PublishedTaxRule = {
  tenantId,
  id: "tax_rule_inc_8",
  version: 7,
  name: "independent-restaurant",
  taxClassification: "restaurant service",
  validFrom: "2026-01-01",
  taxes: [{ code: "04", rate: "0.08" }],
  rutResponsibilities: [],
};

const adoptedProfile: AdoptedFiscalProfile = {
  tenantId,
  taxpayerId: "taxpayer_a",
  id: profileId,
  templateId: "tax_template_restaurant",
  profile: {
    personType: "juridical",
    regime: "ordinary",
    vatResponsible: true,
    incResponsible: true,
    franchise: false,
    rutResponsibilities: ["O-13"],
    municipalities: [{ siteId: "venue_north", municipality: "Medellin" }],
  },
  rules: [],
};

class CountingFactus extends FactusSimulator {
  issues = 0;

  override async issue() {
    this.issues += 1;

    return super.issue();
  }
}

const openCloud = async (seedQuote: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
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

  if (seedQuote) {
    await taxRules.insert(incRule);
    await fiscalProfiles.insertAdopted(adoptedProfile);
  }

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
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

  return { application, taxRules, fiscalProfiles, factus };
};

const postQuote = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/tax-quotes`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

it("given an owner session, when POST /tenants/:tenantId/tax-quotes quotes G-INC-8, then the response is 200 with base 10000 and INC 800", async () => {
  const { application, factus } = await openCloud(true);

  try {
    expect(routePermissions["POST tax-quotes"]).toBe("tax.configure");
    expect(application.get(TaxQuoteController)).toBeInstanceOf(
      TaxQuoteController,
    );

    const response = await postQuote(application, "session_owner", quoteBody);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lines: [
        {
          base: 10_000,
          taxes: [{ code: "04", rate: "0.08", amount: 800 }],
          excluded: false,
          ruleId: "tax_rule_inc_8",
          version: 7,
        },
      ],
      bagLine: null,
      cashRoundingAmount: 0,
    });
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a cashier session without tax.configure, when POST /tax-quotes is injected, then the response is 403 and nothing is saved", async () => {
  const { application, taxRules, fiscalProfiles, factus } =
    await openCloud(true);
  const beforeRules = await taxRules.list(tenantId);
  const beforeProfile = await fiscalProfiles.findAdopted(tenantId, profileId);

  try {
    const response = await postQuote(application, "session_cashier", quoteBody);
    const afterRules = await taxRules.list(tenantId);
    const afterProfile = await fiscalProfiles.findAdopted(tenantId, profileId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "TaxConfigureDenied" });
    expect(afterRules).toEqual(beforeRules);
    expect(afterProfile).toEqual(beforeProfile);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /tax-quotes sends a bad body, then the response is 400 and nothing is saved", async () => {
  const { application, taxRules, fiscalProfiles, factus } =
    await openCloud(false);

  try {
    const response = await postQuote(application, "session_owner", {
      channel: "pickup",
    });

    expect(response.statusCode).toBe(400);
    expect(await taxRules.list(tenantId)).toEqual([]);
    expect(
      await fiscalProfiles.findAdopted(tenantId, profileId),
    ).toBeUndefined();
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});

it("given an owner session, when no tax rule matches, then the response is 409 NoMatchingTaxRule and nothing is saved", async () => {
  const { application, taxRules, factus } = await openCloud(false);

  try {
    const response = await postQuote(application, "session_owner", quoteBody);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "NoMatchingTaxRule" });
    expect(await taxRules.list(tenantId)).toEqual([]);
    expect(factus.issues).toBe(0);
  } finally {
    await application.close();
  }
});
