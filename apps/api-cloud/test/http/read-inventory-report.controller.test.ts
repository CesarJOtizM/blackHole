import { existsSync } from "node:fs";
import {
  foodCostReportResult,
  stockGapReportResult,
} from "@blackhole/contracts";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  ReadInventoryReportController,
  routePermissions,
} from "#src/http/read-inventory-report.controller.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const otherVenueId = "organization_venue_2";
const kitchenChiefId = "user_kitchen";
const siteAdministratorId = "user_site";
const sessionHeader = "x-session-id";
const openedAt = Date.parse("2026-10-28T12:00:00.000Z");
const period = {
  from: "2026-11-01T05:00:00.000Z",
  to: "2026-11-08T05:00:00.000Z",
};

const localNodeRoute = new URL(
  "../../../local-node/src/http/read-inventory-report.controller.ts",
  import.meta.url,
);

const reportUrl = (venue: string, family: string): string =>
  `/tenants/${tenantId}/venues/${venue}/inventory-reports/${family}?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;

const openInventoryCloud = async (): Promise<NestFastifyApplication> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const pinHash = "pin-hash:site";

  identity.registerUser({
    id: kitchenChiefId,
    displayName: kitchenChiefId,
    passwordHash: await passwords.hash("secret"),
    pinHash: `pin-hash:${kitchenChiefId}`,
  });
  identity.signInAdministration({
    userId: kitchenChiefId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_kitchen",
  });
  identity.registerUser({
    id: siteAdministratorId,
    displayName: siteAdministratorId,
    passwordHash: await passwords.hash("secret"),
    pinHash,
  });
  identity.issueRegistrationCode({
    id: "registration_site",
    venueId,
    codeHash: "registration-code-hash",
    now: openedAt,
  });
  identity.registerDevice({
    registrationId: "registration_site",
    codeHash: "registration-code-hash",
    deviceId: "device_site",
    userId: siteAdministratorId,
    venueId,
    publicKey: "device-public-key",
    now: openedAt,
  });
  identity.startPinSession({
    userId: siteAdministratorId,
    deviceId: "device_site",
    pinHash,
    sessionId: "session_site",
  });

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_kitchen",
        userId: kitchenChiefId,
        roleId: "kitchenChief",
        scopeKind: "company",
        scopeId: tenantId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_site",
        userId: siteAdministratorId,
        roleId: "siteAdministrator",
        scopeKind: "site",
        scopeId: venueId,
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

  return createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(openedAt),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(openedAt)),
    authorizations,
    audits: new InMemoryAuditRepository(),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });
};

const getReport = (
  application: NestFastifyApplication,
  venue: string,
  family: string,
  sessionId: string,
) =>
  application.inject({
    method: "GET",
    url: reportUrl(venue, family),
    headers: { [sessionHeader]: sessionId },
  });

it("given a kitchen chief without inventory.view-cost, when GET inventory reports is injected, then both families are denied and not zeroed", async () => {
  const application = await openInventoryCloud();

  try {
    const foodCost = await getReport(
      application,
      venueId,
      "food-cost",
      "session_kitchen",
    );
    const stockGap = await getReport(
      application,
      venueId,
      "stock-gap",
      "session_kitchen",
    );

    expect(foodCost.statusCode).toBe(403);
    expect(foodCost.json()).toEqual({ error: "missing_permission" });
    expect(stockGap.statusCode).toBe(403);
    expect(stockGap.json()).toEqual({ error: "missing_permission" });
    expect(JSON.stringify(foodCost.json())).not.toContain('"ratio":0');
    expect(JSON.stringify(stockGap.json())).not.toContain(
      '"differenceQuantity":0',
    );
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given a site administrator, when GET stock gap is injected for another venue, then the response is denied", async () => {
  const application = await openInventoryCloud();

  try {
    const response = await getReport(
      application,
      otherVenueId,
      "stock-gap",
      "session_site",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "other_venue" });
    expect(JSON.stringify(response.json())).not.toContain(
      '"differenceQuantity":0',
    );
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given the home venue and inventory.view-cost, when GET inventory reports is injected, then stock gap is pending and not zero", async () => {
  const application = await openInventoryCloud();

  try {
    expect(routePermissions).toEqual({
      "GET inventory-reports/:family": "inventory.view-cost",
    });
    expect(existsSync(localNodeRoute)).toBe(false);
    expect(application.get(ReadInventoryReportController)).toBeInstanceOf(
      ReadInventoryReportController,
    );

    const foodCost = await getReport(
      application,
      venueId,
      "food-cost",
      "session_site",
    );
    const stockGap = await getReport(
      application,
      venueId,
      "stock-gap",
      "session_site",
    );

    expect(foodCost.statusCode).toBe(200);
    expect(foodCostReportResult.safeParse(foodCost.json()).success).toBe(true);
    expect(foodCost.json()).toMatchObject({
      outcome: "ready",
      report: { ratio: null },
    });
    expect(stockGap.statusCode).toBe(200);
    expect(stockGapReportResult.safeParse(stockGap.json()).success).toBe(true);
    expect(stockGap.json()).toEqual({
      outcome: "ready",
      report: { status: "pending" },
    });
    expect(JSON.stringify(stockGap.json())).not.toContain(
      '"differenceQuantity":0',
    );
    expect(JSON.stringify(stockGap.json())).not.toContain('"differenceCop":0');
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});
