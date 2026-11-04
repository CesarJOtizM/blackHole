import { reprintDocumentCommand } from "@blackhole/contracts";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { PERMISSION } from "@blackhole/platform/application/entry-port";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Authorization } from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import { PendingSalePrinter } from "#src/composition/sale-receipt.js";
import {
  MemoryReprintAudit,
  ReprintCap,
  routePermissions,
} from "#src/http/printing.controller.js";

const tenantId = "organization_tenant_1";
const actorId = "identity_cashier";
const deviceId = "device_register";
const documentId = "invoice_setp990000001";
const occurredAt = "2026-11-02T18:00:00.000Z";
const actorHeader = "x-actor-id";
const deviceHeader = "x-device-id";

const authorizationId = "request_reprint";
const authorizerId = "identity_owner";
const reprintBody = { document: documentId };
const recordedReprint = {
  action: "sale.reprint",
  actorId,
  deviceId,
  document: documentId,
  occurredAt,
};

it("given a numeric reprint cap, when a document is reprinted, then one sale.reprint records the actor, device, document, and time", async () => {
  const { application, audits } = await openCloud(3);

  try {
    expect(reprintDocumentCommand.safeParse(reprintBody).success).toBe(true);
    expect(routePermissions).toEqual({ "POST reprints": "sale.reprint" });

    const response = await postReprint(application, reprintBody);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(recordedReprint);
    expect(audits.events).toEqual([recordedReprint]);
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a null reprint cap, when a document is reprinted, then the response is 409 ReprintCapUnconfigured and nothing is stored", async () => {
  const { application, audits } = await openCloud(null);

  try {
    const response = await postReprint(application, reprintBody);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "ReprintCapUnconfigured" });
    expect(audits.events).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a reprint body the schema rejects, when it is posted, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCloud(3);

  try {
    expect(reprintDocumentCommand.safeParse({ document: "" }).success).toBe(
      false,
    );
    expect(
      reprintDocumentCommand.safeParse({ ...reprintBody, limit: null }).success,
    ).toBe(false);
    expect(
      reprintDocumentCommand.safeParse({ ...reprintBody, authorizerId })
        .success,
    ).toBe(false);
    expect(
      reprintDocumentCommand.safeParse({
        ...reprintBody,
        shiftTotals: { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 },
      }).success,
    ).toBe(false);
    expect(
      reprintDocumentCommand.safeParse({
        ...reprintBody,
        authorizationId: null,
      }).success,
    ).toBe(true);

    const response = await postReprint(application, { document: "" });
    const authorizerResponse = await postReprint(application, {
      ...reprintBody,
      authorizerId,
    });
    const totalsResponse = await postReprint(application, {
      ...reprintBody,
      shiftTotals: { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(authorizerResponse.statusCode).toBe(400);
    expect(totalsResponse.statusCode).toBe(400);
    expect(audits.events).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a cap of 1 and one existing reprint, when a second reprint has no authorization, then no new audit is stored and PendingSalePrinter.jobs is unchanged", async () => {
  const { application, audits } = await openCloud(1);

  try {
    const printer = application.get(PendingSalePrinter);
    const first = await postReprint(application, reprintBody);

    expect(first.statusCode).toBe(200);
    const jobs = printer.jobs.map((job) => ({ ...job }));

    const response = await postReprint(application, reprintBody);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "ReprintNeedsAuthorization" });
    expect(audits.events).toEqual([recordedReprint]);
    expect(printer.jobs).toEqual(jobs);
  } finally {
    await application.close();
  }
});

it("given a cap of 1, one existing reprint, and a resolved authorizer, when the second reprint is posted, then one more sale.reprint is stored with that authorizer and PendingSalePrinter.jobs is unchanged", async () => {
  const { application, audits } = await openCloud(1);

  try {
    const printer = application.get(PendingSalePrinter);

    expect(
      reprintDocumentCommand.safeParse({
        document: documentId,
        authorizationId,
      }).success,
    ).toBe(true);
    await approveReprint(application);
    await postReprint(application, reprintBody);
    const jobs = printer.jobs.map((job) => ({ ...job }));

    const response = await postReprint(application, {
      document: documentId,
      authorizationId,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...recordedReprint, authorizerId });
    expect(audits.events).toEqual([
      recordedReprint,
      { ...recordedReprint, authorizerId },
    ]);
    expect(printer.jobs).toEqual(jobs);
  } finally {
    await application.close();
  }
});

async function openCloud(limit: number | null) {
  const identities = new InMemoryIdentityRepository();
  const clock = new FakeClock(Date.parse(occurredAt));
  const audits = new MemoryReprintAudit();
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new FastPasswordHasher(),
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    reprintCap: new ReprintCap(limit),
    reprintAudits: audits,
  });

  return { application, audits };
}

async function approveReprint(application: NestFastifyApplication) {
  const authorizations = application.get(AuthorizationRepository);
  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [],
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [
      {
        id: "resolution_reprint",
        requestId: authorizationId,
        requesterId: actorId,
        authorizerId,
        action: PERMISSION.SALE_REPRINT,
        value: null,
        reason: "Reprint over the cap",
        deviceId,
        occurredAt: Date.parse(occurredAt),
        selfAuthorized: false,
        approved: true,
      },
    ],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });

  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });
}

function postReprint(
  application: Awaited<ReturnType<typeof createApplication>>,
  payload: object,
) {
  return application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/reprints`,
    headers: {
      [actorHeader]: actorId,
      [deviceHeader]: deviceId,
    },
    payload,
  });
}
