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
import { expect, it } from "vitest";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
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

const reprintBody = { document: documentId };

it("given a numeric reprint cap, when a document is reprinted, then one sale.reprint records the actor, device, document, and time", async () => {
  const { application, audits } = await openCloud(3);

  try {
    expect(reprintDocumentCommand.safeParse(reprintBody).success).toBe(true);
    expect(routePermissions).toEqual({ "POST reprints": "sale.reprint" });

    const response = await postReprint(application, reprintBody);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: "sale.reprint",
      actorId,
      deviceId,
      document: documentId,
      occurredAt,
    });
    expect(audits.events).toEqual([
      {
        action: "sale.reprint",
        actorId,
        deviceId,
        document: documentId,
        occurredAt,
      },
    ]);
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

    const response = await postReprint(application, { document: "" });

    expect(response.statusCode).toBe(400);
    expect(audits.events).toEqual([]);
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
