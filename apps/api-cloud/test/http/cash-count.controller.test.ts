import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
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
import type { OrganizationSnapshot } from "@blackhole/platform/application/ports/organization-repository";
import {
  Authorization,
  Identity,
  Organization,
} from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";

import { MemoryCashCounts } from "#src/composition/application-module.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  CashCountController,
  routePermissions,
} from "#src/http/cash-count.controller.js";
import {
  openedAt,
  ownerId,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const kitchenChiefId = "user_kitchen";
const registerId = "organization_register_front";
const shiftId = "shift_front_1";
const countId = "count_front_1";
const openingFloatCop = 100_000;
const countedCashCop = 90_000;
const differenceCop = -10_000;
const varianceCop = 10_000;

const people = [
  [ownerId, "session_owner", "owner"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
] as const;

const openBody = {
  shiftId,
  openingFloatCop,
};

const countBody = {
  countId,
  denominations: [{ denomination: 10_000, quantity: 9 }],
  terminals: [],
};

const approveBody = {
  justification: "Drawer was short",
  varianceCop,
};

const finalBody = {
  varianceCop,
};

const partialBody = {
  countId,
};

const openUrl = `/tenants/${tenantId}/venues/${venueId}/cash-registers/${registerId}/open`;
const countUrl = `/tenants/${tenantId}/venues/${venueId}/cash-registers/${registerId}/count`;
const approveUrl = `${countUrl}/approve`;
const partialUrl = `${countUrl}/partial-close`;
const finalUrl = `${countUrl}/final-close`;

const blindCount = {
  state: "counting",
  countedCashCop,
  differenceCop,
};

const picture = (organization: Organization): OrganizationSnapshot => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

const openCountCloud = async (): Promise<{
  application: NestFastifyApplication;
  registers: InMemoryCashRegisterRepository;
  counts: MemoryCashCounts;
  audits: InMemoryAuditRepository;
}> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const organizations = new InMemoryOrganizationRepository();
  const registers = new InMemoryCashRegisterRepository();
  const counts = new MemoryCashCounts();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

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

  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: "organization_taxpayer_1",
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: "organization_brand_1", name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId: "organization_brand_1",
    taxpayerId: "organization_taxpayer_1",
    pointId: "organization_point_1",
  });
  organization.addCashRegister({
    id: registerId,
    venueId,
    name: "Front",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: people.map(([userId, , roleId]) => ({
      id: `assignment_${roleId}`,
      userId,
      roleId,
      scopeKind: "company" as const,
      scopeId: tenantId,
      validFrom: null,
      validUntil: null,
    })),
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

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(Date.parse(openedAt)),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(
      identities,
      new FakeClock(Date.parse(openedAt)),
    ),
    authorizations,
    audits,
    registers,
    counts,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, registers, counts, audits };
};

const send = (
  application: NestFastifyApplication,
  method: "GET" | "POST",
  url: string,
  sessionId: string,
  payload?: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method,
    url,
    headers: { [sessionHeader]: sessionId },
    ...(payload === undefined
      ? {}
      : { payload: payload as Record<string, unknown> }),
  });

const openShift = (
  application: NestFastifyApplication,
): Promise<{ statusCode: number; json: () => unknown }> =>
  send(application, "POST", openUrl, "session_owner", openBody);

it("given an open shift, when the count is read before and after submit, then the JSON omits expected cash", async () => {
  const { application, counts, audits } = await openCountCloud();

  try {
    expect(routePermissions).toEqual({
      "GET cash-registers/:registerId/count": "cash.open-shift",
      "POST cash-registers/:registerId/count": "cash.open-shift",
      "POST cash-registers/:registerId/count/approve": "cash.approve-variance",
      "POST cash-registers/:registerId/count/partial-close": "cash.open-shift",
      "POST cash-registers/:registerId/count/final-close": "cash.open-shift",
    });
    expect(application.get(CashCountController)).toBeInstanceOf(
      CashCountController,
    );

    const opened = await openShift(application);
    const before = await send(application, "GET", countUrl, "session_owner");
    const submitted = await send(
      application,
      "POST",
      countUrl,
      "session_owner",
      countBody,
    );
    const after = await send(application, "GET", countUrl, "session_owner");
    const events = await audits.list(tenantId, null);

    expect(opened.statusCode).toBe(200);
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ state: "open" });
    expect(JSON.stringify(before.json())).not.toContain("expected");
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json()).toEqual(blindCount);
    expect(JSON.stringify(submitted.json())).not.toContain("expected");
    expect(after.statusCode).toBe(200);
    expect(after.json()).toEqual(blindCount);
    expect(JSON.stringify(after.json())).not.toContain("expected");
    expect(counts.saves).toBe(1);
    expect(events).toEqual([
      expect.objectContaining({
        action: "cash.open-shift",
        entity: registerId,
      }),
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "cash.open-shift",
        entity: registerId,
        before: null,
        after: blindCount,
        reason: "cash.open-shift",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given the owner counted a short drawer, when that same person approves, then the response is 409 SelfApprovalRejected and nothing changes", async () => {
  const { application, registers, counts, audits } = await openCountCloud();

  try {
    await openShift(application);
    await send(application, "POST", countUrl, "session_owner", countBody);
    const savesAfterSubmit = counts.saves;
    const auditsAfterSubmit = (await audits.list(tenantId, null)).length;

    const rejected = await send(
      application,
      "POST",
      approveUrl,
      "session_owner",
      approveBody,
    );
    const stillCounting = await send(
      application,
      "GET",
      countUrl,
      "session_owner",
    );
    const stillNeedsApproval = await send(
      application,
      "POST",
      finalUrl,
      "session_owner",
      finalBody,
    );
    const shift = await registers.load(tenantId, venueId, registerId);

    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({ error: "SelfApprovalRejected" });
    expect(counts.saves).toBe(savesAfterSubmit);
    expect(stillCounting.json()).toEqual(blindCount);
    expect(JSON.stringify(stillCounting.json())).not.toContain("expected");
    expect(stillNeedsApproval.statusCode).toBe(409);
    expect(stillNeedsApproval.json()).toEqual({
      error: "VarianceNeedsApproval",
    });
    expect(shift?.state).toBe("open");
    expect(await audits.list(tenantId, null)).toHaveLength(auditsAfterSubmit);
  } finally {
    await application.close();
  }
});

it("given a short count that still needs approval, when a final close is posted, then the response is 409 and the shift stays counting", async () => {
  const { application, registers, counts, audits } = await openCountCloud();

  try {
    await openShift(application);
    await send(application, "POST", countUrl, "session_owner", countBody);
    const savesAfterSubmit = counts.saves;
    const auditsAfterSubmit = (await audits.list(tenantId, null)).length;

    const rejected = await send(
      application,
      "POST",
      finalUrl,
      "session_owner",
      finalBody,
    );
    const reading = await send(application, "GET", countUrl, "session_owner");
    const shift = await registers.load(tenantId, venueId, registerId);

    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({ error: "VarianceNeedsApproval" });
    expect(counts.saves).toBe(savesAfterSubmit);
    expect(reading.json()).toEqual(blindCount);
    expect(JSON.stringify(reading.json())).not.toContain("expected");
    expect(shift?.state).toBe("open");
    expect(reading.json()).toMatchObject({ state: "counting" });
    expect(await audits.list(tenantId, null)).toHaveLength(auditsAfterSubmit);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST count is injected, then the response is 403 and nothing is saved", async () => {
  const { application, registers, counts, audits } = await openCountCloud();

  try {
    const response = await send(
      application,
      "POST",
      countUrl,
      "session_kitchen",
      countBody,
    );
    const shift = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "CashOpenShiftDenied" });
    expect(counts.saves).toBe(0);
    expect(shift).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST count sends a bad body, then the response is 400 and nothing is saved", async () => {
  const { application, counts, audits } = await openCountCloud();

  try {
    const opened = await openShift(application);
    const missing = await send(
      application,
      "POST",
      countUrl,
      "session_owner",
      {},
    );
    const stamped = await send(application, "POST", countUrl, "session_owner", {
      ...countBody,
      occurredAt: openedAt,
    });
    const reading = await send(application, "GET", countUrl, "session_owner");

    expect(opened.statusCode).toBe(200);
    expect(missing.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(counts.saves).toBe(0);
    expect(reading.json()).toEqual({ state: "open" });
    expect(JSON.stringify(reading.json())).not.toContain("expected");
    expect(await audits.list(tenantId, null)).toHaveLength(1);
  } finally {
    await application.close();
  }
});

it("given a submitted count, when a partial close is done, then the shift stays open", async () => {
  const { application, registers, counts, audits } = await openCountCloud();

  try {
    await openShift(application);
    await send(application, "POST", countUrl, "session_owner", countBody);

    const closed = await send(
      application,
      "POST",
      partialUrl,
      "session_owner",
      partialBody,
    );
    const reading = await send(application, "GET", countUrl, "session_owner");
    const shift = await registers.load(tenantId, venueId, registerId);
    const events = await audits.list(tenantId, null);

    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual({
      state: "open",
      countedCashCop,
      differenceCop,
    });
    expect(JSON.stringify(closed.json())).not.toContain("expected");
    expect(reading.json()).toEqual({
      state: "open",
      countedCashCop,
      differenceCop,
    });
    expect(JSON.stringify(reading.json())).not.toContain("expected");
    expect(shift?.state).toBe("open");
    expect(counts.saves).toBe(2);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        actorId: ownerId,
        action: "cash.open-shift",
        entity: registerId,
        before: null,
        after: {
          state: "open",
          countedCashCop,
          differenceCop,
        },
        reason: "cash.open-shift",
      }),
    );
  } finally {
    await application.close();
  }
});
