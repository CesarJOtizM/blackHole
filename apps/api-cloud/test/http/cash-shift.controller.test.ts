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

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  CashShiftController,
  routePermissions,
} from "#src/http/cash-shift.controller.js";
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
const openingFloatCop = 200_000;

const people = [
  [ownerId, "session_owner", "owner"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
] as const;

const openBody = {
  shiftId,
  openingFloatCop,
};

const openUrl = `/tenants/${tenantId}/venues/${venueId}/cash-registers/${registerId}/open`;

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

const openCashCloud = async (): Promise<{
  application: NestFastifyApplication;
  registers: InMemoryCashRegisterRepository;
  audits: InMemoryAuditRepository;
}> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const organizations = new InMemoryOrganizationRepository();
  const registers = new InMemoryCashRegisterRepository();
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
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, registers, audits };
};

const postShift = (
  application: NestFastifyApplication,
  sessionId: string,
  payload: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "POST",
    url: openUrl,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

it("given an owner session and a register with no shift, when POST open declares a 200000 float, then the response is 200, the shift id uses shift_, and the audit records the open", async () => {
  const { application, registers, audits } = await openCashCloud();

  try {
    expect(routePermissions["POST cash-registers/:registerId/open"]).toBe(
      "cash.open-shift",
    );
    expect(application.get(CashShiftController)).toBeInstanceOf(
      CashShiftController,
    );

    const response = await postShift(application, "session_owner", openBody);
    const stored = await registers.load(tenantId, venueId, registerId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: shiftId,
      registerId,
      cashierId: ownerId,
      openingFloatCop,
      state: "open",
    });
    expect(stored?.id).toBe(shiftId);
    expect(stored?.id?.startsWith("shift_")).toBe(true);
    expect(stored?.cashierId).toBe(ownerId);
    expect(stored?.openingFloatCop).toBe(openingFloatCop);
    expect(stored?.state).toBe("open");
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "cash.open-shift",
        entity: registerId,
        before: null,
        after: {
          id: shiftId,
          registerId,
          cashierId: ownerId,
          openingFloatCop,
          state: "open",
        },
        reason: "cash.open-shift",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST open is injected, then the response is 403, nothing is saved, and nothing is audited", async () => {
  const { application, registers, audits } = await openCashCloud();

  try {
    const response = await postShift(application, "session_kitchen", openBody);
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "CashOpenShiftDenied" });
    expect(stored).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST open sends a bad body, then the response is 400, nothing is saved, and nothing is audited", async () => {
  const { application, registers, audits } = await openCashCloud();

  try {
    const missing = await postShift(application, "session_owner", {});
    const stamped = await postShift(application, "session_owner", {
      ...openBody,
      occurredAt: openedAt,
    });
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(missing.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(stored).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open shift, when POST open is injected again on the same register, then the response is 409 ShiftAlreadyOpen, the first shift stays, and the rejection is not audited", async () => {
  const { application, registers, audits } = await openCashCloud();

  try {
    const opened = await postShift(application, "session_owner", openBody);
    const rejected = await postShift(application, "session_owner", {
      shiftId: "shift_front_2",
      openingFloatCop: 100_000,
    });
    const stored = await registers.load(tenantId, venueId, registerId);
    const events = await audits.list(tenantId, null);

    expect(opened.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({ error: "ShiftAlreadyOpen" });
    expect(stored?.id).toBe(shiftId);
    expect(stored?.openingFloatCop).toBe(openingFloatCop);
    expect(stored?.cashierId).toBe(ownerId);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        action: "cash.open-shift",
        entity: registerId,
      }),
    );
  } finally {
    await application.close();
  }
});
