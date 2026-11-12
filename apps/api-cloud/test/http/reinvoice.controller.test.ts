import {
  ApproveReinvoice,
  type CreditNoteValidation,
  type InvoiceValidation,
  InvoicingProvider,
  IssueCreditNote,
} from "@blackhole/invoicing/application/entry-port";
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
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it, vi } from "vitest";
import { MemoryReinvoiceRequests } from "#src/composition/application-module.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import { routePermissions } from "#src/http/reinvoice.controller.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const cashierId = "user_cashier";
const managerId = "user_manager";
const sessionHeader = "x-session-id";
const invoiceNumber = "SETP990000001";
const issuedAt = "2026-11-11T15:00:00.000Z";
const sameDay = "2026-11-11T18:00:00.000Z";
const nextDay = "2026-11-12T15:00:00.000Z";
const prefix = `/tenants/${tenantId}/venues/${venueId}`;

const people = [
  [cashierId, "session_cashier", "cashier"],
  [managerId, "session_manager", "generalManager"],
] as const;

class CountingProvider extends InvoicingProvider {
  readonly calls: string[] = [];

  override async validate(_invoice: InvoiceValidation): Promise<void> {
    this.calls.push("validate");
  }

  override async lookupAcquirer(): Promise<never> {
    this.calls.push("lookup");
    throw new Error("lookup");
  }

  override async downloadPdf(): Promise<never> {
    this.calls.push("downloadPdf");
    throw new Error("downloadPdf");
  }

  override async validateCreditNote(
    _note: CreditNoteValidation,
  ): Promise<void> {
    this.calls.push("validateCreditNote");
  }
}

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const provider = new CountingProvider();
  const requests = new MemoryReinvoiceRequests();

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

  const clock = new FakeClock(0);
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    authorizations,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    invoicingProvider: provider,
    reinvoiceRequests: requests,
  });

  return { application, provider, requests };
};

const postReinvoice = (
  application: NestFastifyApplication,
  sessionId: string | null,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `${prefix}/reinvoices`,
    headers: sessionId === null ? {} : { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const body = (at: string, windowMode: "same_day" | "same_month" | "off") => ({
  invoiceNumber,
  issuedAt,
  at,
  windowMode,
});

it("given a cashier session, when re-invoicing is requested, then the response is 403 and nothing is stored", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST reinvoices"]).toBe("sale.credit-note");

    const response = await postReinvoice(
      cloud.application,
      "session_cashier",
      body(sameDay, "same_day"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleCreditNoteDenied" });
    expect(cloud.requests.rows).toEqual([]);
    expect(cloud.provider.calls).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given a credit-note holder and a closed window, when re-invoicing is requested, then it is rejected and Factus is not called", async () => {
  const cloud = await openCloud();

  try {
    const next = await postReinvoice(
      cloud.application,
      "session_manager",
      body(nextDay, "same_day"),
    );
    const off = await postReinvoice(
      cloud.application,
      "session_manager",
      body(sameDay, "off"),
    );

    expect(next.statusCode).toBe(200);
    expect(next.json()).toEqual({ outcome: "rejected" });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toEqual({ outcome: "rejected" });
    expect(cloud.requests.rows).toEqual([]);
    expect(cloud.provider.calls).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given a credit-note holder inside the same day, when re-invoicing is requested, then the request is stored and Factus is not called", async () => {
  const cloud = await openCloud();

  try {
    const response = await postReinvoice(
      cloud.application,
      "session_manager",
      body(sameDay, "same_day"),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "recorded" });
    expect(cloud.requests.rows).toEqual([
      {
        companyId: tenantId,
        invoiceNumber,
        issuedAt,
        requestedAt: sameDay,
        status: "pending",
      },
    ]);
    expect(cloud.provider.calls).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

const originalReference = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const creditNoteReference = "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20";
const nextReference = "01932f4a-9c3a-7b2d-8e1f-6a5b4c3d2e21";

const approveBody = (
  at: string,
  windowMode: "same_day" | "same_month" | "off",
) => ({
  invoiceNumber,
  at,
  windowMode,
  original: {
    closureId: "closure_front_1",
    referenceCode: originalReference,
    status: "accepted",
    buyer: {
      documentType: "13",
      documentNumber: "222222222222",
      name: "Consumidor final",
      responsibility: "R-99-PN",
      email: "facturas@taxpayer.example",
    },
    number: invoiceNumber,
  },
  creditNote: {
    referenceCode: creditNoteReference,
    tenantId,
    actorId: managerId,
    authorizerId: null,
    deviceId: "device_register",
    siteId: venueId,
    reason: "Customer asked to re-invoice",
  },
  invoice: {
    closureId: "closure_reinvoice_1",
    referenceCode: nextReference,
    taxpayerEmail: "buyer@customer.example",
    documentBalance: 0,
    rules: [],
    siteRangeId: "range-site-1",
  },
});

const postApprove = (
  application: NestFastifyApplication,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `${prefix}/reinvoices/approve`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const pendingRequest = () => ({
  companyId: tenantId,
  invoiceNumber,
  issuedAt,
  requestedAt: sameDay,
  status: "pending" as const,
});

it("given a cashier session, when approval is posted, then the response is 403 and the credit note and Factus stay idle", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST reinvoices/approve"]).toBe(
      "sale.credit-note",
    );
    const issued = vi.spyOn(cloud.application.get(IssueCreditNote), "execute");
    const response = await postApprove(
      cloud.application,
      "session_cashier",
      approveBody(sameDay, "same_day"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleCreditNoteDenied" });
    expect(issued).not.toHaveBeenCalled();
    expect(cloud.provider.calls).toEqual([]);
    expect(cloud.requests.rows).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given a credit-note holder inside the window, when approval is posted, then ApproveReinvoice runs once", async () => {
  const cloud = await openCloud();

  try {
    cloud.requests.rows.push(pendingRequest());
    const ran = vi.spyOn(cloud.application.get(ApproveReinvoice), "execute");
    const response = await postApprove(
      cloud.application,
      "session_manager",
      approveBody(sameDay, "same_day"),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "approved" });
    expect(ran).toHaveBeenCalledOnce();
    expect(cloud.provider.calls).toEqual(["validateCreditNote"]);
  } finally {
    await cloud.application.close();
  }
});

it("given a credit-note holder outside the window, when approval is posted, then Factus is not called", async () => {
  const cloud = await openCloud();

  try {
    cloud.requests.rows.push(pendingRequest());
    const next = await postApprove(
      cloud.application,
      "session_manager",
      approveBody(nextDay, "same_day"),
    );
    const off = await postApprove(
      cloud.application,
      "session_manager",
      approveBody(sameDay, "off"),
    );

    expect(next.statusCode).toBe(200);
    expect(next.json()).toEqual({ outcome: "rejected" });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toEqual({ outcome: "rejected" });
    expect(cloud.provider.calls).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});
