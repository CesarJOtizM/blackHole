import { MemoryPinVerifier } from "@blackhole/platform/adapters/memory/authorization-doubles";
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
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  AttendanceController,
  routePermissions,
} from "#src/http/attendance.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const otherVenueId = "organization_venue_2";
const taxpayerId = "organization_taxpayer_1";
const adminId = "user_admin";
const cashierId = "user_cashier";
const registerId = "organization_register_1";
const sessionHeader = "x-session-id";
const pin = "2468";
const now = Date.parse("2026-10-26T13:00:00.000Z");
const point = { latitude: 4.65, longitude: -74.05 };

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

const policyBody = {
  mode: "hours_only" as const,
  geofence: { ...point, radiusMeters: 50 },
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled: false,
};

const clockBody = (commandId: string) => ({
  pin,
  kind: "clock_in" as const,
  coordinates: point,
  commandId,
});

const openCloud = async (
  cashierAssignment: { validFrom: number | null; validUntil: number | null } = {
    validFrom: null,
    validUntil: null,
  },
) => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const pinHash = `pin-hash:${cashierId}`;

  identity.registerUser({
    id: adminId,
    displayName: adminId,
    passwordHash: await passwords.hash("secret"),
    pinHash: `pin-hash:${adminId}`,
  });
  identity.signInAdministration({
    userId: adminId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_admin",
  });
  identity.registerUser({
    id: cashierId,
    displayName: cashierId,
    passwordHash: await passwords.hash("secret"),
    pinHash,
  });
  identity.issueRegistrationCode({
    id: "registration_cashier",
    venueId,
    codeHash: "registration-code-hash",
    now,
  });
  identity.registerDevice({
    registrationId: "registration_cashier",
    codeHash: "registration-code-hash",
    deviceId: "device_cashier",
    userId: cashierId,
    venueId,
    publicKey: "device-public-key",
    now,
  });
  identity.startPinSession({
    userId: cashierId,
    deviceId: "device_cashier",
    pinHash,
    sessionId: "session_cashier",
  });

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: taxpayerId,
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: brandId, name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId,
    taxpayerId,
    pointId: "organization_point_1",
  });
  organization.openVenue({
    id: otherVenueId,
    name: "Site two",
    brandId,
    taxpayerId,
    pointId: "organization_point_2",
  });
  organization.addCashRegister({
    id: registerId,
    venueId,
    name: "Register",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: adminId,
    before: stored,
    after: stored,
  });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_admin",
        userId: adminId,
        roleId: "siteAdministrator",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_cashier",
        userId: cashierId,
        roleId: "cashier",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: cashierAssignment.validFrom,
        validUntil: cashierAssignment.validUntil,
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

  const clock = new FakeClock(now);
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    pinConfirmations: new MemoryPinVerifier(new Map([[cashierId, pin]])),
    authorizations,
    audits: new InMemoryAuditRepository(),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return application;
};

type Application = Awaited<ReturnType<typeof openCloud>>;

const inject = (
  application: Application,
  method: "GET" | "POST" | "PUT",
  venue: string,
  url: string,
  sessionId: string,
  payload?: unknown,
) =>
  application.inject({
    method,
    url: `/tenants/${tenantId}/venues/${venue}/${url}`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown> | undefined,
  });

it("given a cashier pin on a registered device, when the cashier clocks in, then the response is 200 and the register is recorded", async () => {
  const application = await openCloud();

  try {
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
    expect(application.get(AttendanceController)).toBeInstanceOf(
      AttendanceController,
    );
    expect(routePermissions).toEqual({
      "POST clock-entries": "pin",
      "POST clock-entries/:entryId/corrections": "attendance.correct",
      "PUT attendance/policy": "attendance.correct",
      "POST attendance/export": "attendance.correct",
    });
    expect(Object.values(routePermissions)).not.toContain("attendance.clock");

    const policy = await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    const response = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_open"),
    );

    expect(policy.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "clock_entry_command_open",
      kind: "clock_in",
      presence: "matched",
      occurredAt: new Date(now).toISOString(),
      cashRegisterId: registerId,
    });
  } finally {
    await application.close();
  }
});

it("given an open clock-in, when the same worker clocks in again, then the response is 409", async () => {
  const application = await openCloud();

  try {
    await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_open"),
    );
    const response = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_second"),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "SecondClockIn" });
  } finally {
    await application.close();
  }
});

it("given a cashier session, when the cashier corrects, sets policy, reads, or exports, then each response is 403", async () => {
  const application = await openCloud();

  try {
    await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    const opened = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_open"),
    );
    const entryId = opened.json().id as string;
    const correction = await inject(
      application,
      "POST",
      venueId,
      `clock-entries/${entryId}/corrections`,
      "session_cashier",
      {
        userId: cashierId,
        occurredAt: "2026-10-26T16:00:00.000Z",
        reason: "left early",
      },
    );
    const policy = await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_cashier",
      policyBody,
    );
    const read = await inject(
      application,
      "GET",
      venueId,
      "attendance",
      "session_cashier",
    );
    const exported = await inject(
      application,
      "POST",
      venueId,
      "attendance/export",
      "session_cashier",
      {
        from: "2026-10-26T05:00:00.000Z",
        to: "2026-10-27T05:00:00.000Z",
      },
    );

    expect(correction.statusCode).toBe(403);
    expect(policy.statusCode).toBe(403);
    expect(read.statusCode).toBe(403);
    expect(exported.statusCode).toBe(403);
    expect(correction.json()).toEqual({ error: "AttendanceCorrectDenied" });
  } finally {
    await application.close();
  }
});

it("given a site administrator, when the administrator uses another site, then policy, read, and export are 403", async () => {
  const application = await openCloud();

  try {
    const policy = await inject(
      application,
      "PUT",
      otherVenueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    const read = await inject(
      application,
      "GET",
      otherVenueId,
      "attendance",
      "session_admin",
    );
    const exported = await inject(
      application,
      "POST",
      otherVenueId,
      "attendance/export",
      "session_admin",
      {
        from: "2026-10-26T05:00:00.000Z",
        to: "2026-10-27T05:00:00.000Z",
      },
    );

    expect(policy.statusCode).toBe(403);
    expect(read.statusCode).toBe(403);
    expect(exported.statusCode).toBe(403);
  } finally {
    await application.close();
  }
});

it("given the administrator of the site, when hours are read and exported, then the file has no salary and a client clock is rejected", async () => {
  const application = await openCloud();

  try {
    await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_open"),
    );
    const trusted = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      {
        ...clockBody("command_trusted"),
        occurredAt: "1999-01-01T00:00:00.000Z",
      },
    );
    const read = await inject(
      application,
      "GET",
      venueId,
      "attendance",
      "session_admin",
    );
    const exported = await inject(
      application,
      "POST",
      venueId,
      "attendance/export",
      "session_admin",
      {
        from: "2026-10-26T05:00:00.000Z",
        to: "2026-10-27T05:00:00.000Z",
      },
    );
    const body = String(exported.body);

    expect(trusted.statusCode).toBe(400);
    expect(read.statusCode).toBe(200);
    expect(JSON.stringify(read.json()).toLowerCase()).not.toMatch(/salary/);
    expect(read.json()).toEqual({
      workers: [
        expect.objectContaining({
          userId: cashierId,
          state: "on_shift",
          absent: false,
        }),
      ],
    });
    expect(exported.statusCode).toBe(200);
    expect(body.toLowerCase()).not.toMatch(/salary/);
    expect(body.startsWith("PK")).toBe(true);
  } finally {
    await application.close();
  }
});

it("given an administration session, when it clocks in without a pin device, then the response is 403", async () => {
  const application = await openCloud();

  try {
    const response = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_admin",
      clockBody("command_admin"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "ClockRejected" });
  } finally {
    await application.close();
  }
});

it("given a cashier assignment that has already ended, when the cashier clocks in, then the register is not recorded", async () => {
  const application = await openCloud({ validFrom: null, validUntil: now });

  try {
    const policy = await inject(
      application,
      "PUT",
      venueId,
      "attendance/policy",
      "session_admin",
      policyBody,
    );
    const response = await inject(
      application,
      "POST",
      venueId,
      "clock-entries",
      "session_cashier",
      clockBody("command_expired"),
    );

    expect(policy.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "clock_entry_command_expired",
      kind: "clock_in",
      presence: "matched",
      occurredAt: new Date(now).toISOString(),
      cashRegisterId: null,
    });
  } finally {
    await application.close();
  }
});
