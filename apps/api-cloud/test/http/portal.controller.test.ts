import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { portalBuyerFound } from "@blackhole/contracts";
import { HmacLinkSigner } from "@blackhole/invoicing/adapters/crypto/hmac-link-signer";
import {
  ACQUIRER_LOOKUP,
  type AcquirerLookup,
  type AcquirerQuery,
  type InvoiceValidation,
  InvoicingProvider,
} from "@blackhole/invoicing/application/entry-port";
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
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";
import { MemoryPortalBuyerStore } from "#src/composition/application-module.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const checkId = "check_front_1";
const linkKey = "portal.link-key";
const openedAt = "2026-11-11T15:00:00.000Z";
const later = "2026-11-12T15:00:00.000Z";
const earlier = "2026-11-10T15:00:00.000Z";
const buyerName = "Juan Perez";
const buyerEmail = "juan@gmail.com";

const lookupBody = (token: string) => ({
  token,
  documentType: "13",
  documentNumber: "1234567890",
  at: openedAt,
});

class RecordingProvider extends InvoicingProvider {
  readonly calls: string[] = [];

  constructor(private readonly fail: boolean) {
    super();
  }

  override async validate(_invoice: InvoiceValidation): Promise<void> {
    this.calls.push("validate");
  }

  override async lookupAcquirer(query: AcquirerQuery): Promise<AcquirerLookup> {
    this.calls.push(`lookup:${query.documentNumber}`);

    if (this.fail) {
      throw new Error("provider down");
    }

    return {
      outcome: ACQUIRER_LOOKUP.FOUND,
      name: buyerName,
      email: buyerEmail,
    };
  }
}

const cloudDependencies = (
  secrets: InMemorySecrets,
  provider: RecordingProvider,
  store: MemoryPortalBuyerStore,
  portalLookupLimited = false,
) => {
  const identities = new InMemoryIdentityRepository();
  const clock = new FakeClock(0);

  return {
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
    secrets,
    metrics: new InMemoryRuntimeMetrics(),
    invoicingProvider: provider,
    portalBuyerStore: store,
    portalLookupLimited,
  };
};

const openPortal = async (options?: { fail?: boolean; limited?: boolean }) => {
  const secrets = new InMemorySecrets({ [linkKey]: "portal-test-key" });
  const provider = new RecordingProvider(options?.fail ?? false);
  const store = new MemoryPortalBuyerStore();
  const application = await createApplication(
    cloudDependencies(secrets, provider, store, options?.limited ?? false),
  );

  return { application, provider, store, secrets };
};

const preBillToken = async (
  secrets: InMemorySecrets,
  expiresAt: string,
): Promise<string> => {
  const signed = await new HmacLinkSigner(secrets).sign({
    purpose: "pre_bill",
    tenantId,
    venueId,
    checkId,
    expiresAt,
  });

  return signed.token.slice("/f/".length);
};

const postLookup = (application: NestFastifyApplication, token: string) =>
  application.inject({
    method: "POST",
    url: "/portal/buyers",
    payload: lookupBody(token),
  });

const contractSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../shared/contracts/invoicing-portal.ts",
  ),
  "utf8",
);

it("given no one-time code sender, when the cloud application boots, then it throws before listening", async () => {
  const secrets = new InMemorySecrets({});
  const provider = new RecordingProvider(false);
  const store = new MemoryPortalBuyerStore();

  await expect(
    createApplication({
      ...cloudDependencies(secrets, provider, store),
      oneTimeCodeSender: "unconfigured",
    }),
  ).rejects.toThrow("OneTimeCodeSender is not configured.");
});

it("given a valid pre-bill link and no session, when the customer looks up a known id, then only masks are returned", async () => {
  const portal = await openPortal();

  try {
    const token = await preBillToken(portal.secrets, later);
    const response = await postLookup(portal.application, token);
    const body: unknown = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      outcome: "found",
      lookupId: expect.any(String),
      maskedName: "J*** P***",
      maskedEmail: "j***@gmail.com",
    });
    expect(JSON.stringify(body)).not.toContain(buyerName);
    expect(JSON.stringify(body)).not.toContain(buyerEmail);
    expect(portalBuyerFound.safeParse(body).success).toBe(true);
    expect(
      portalBuyerFound.safeParse({
        ...(body as Record<string, unknown>),
        name: buyerName,
      }).success,
    ).toBe(false);
    expect(portal.store.lookups).toEqual([
      expect.objectContaining({ name: buyerName, email: buyerEmail }),
    ]);
    expect(portal.provider.calls).toEqual(["lookup:1234567890"]);
  } finally {
    await portal.application.close();
  }
});

it("given an unknown, expired, limited, or failed lookup, when the customer posts an id, then every response is the same shapeless refusal", async () => {
  const readable = await openPortal();
  const limited = await openPortal({ limited: true });
  const failed = await openPortal({ fail: true });

  try {
    const live = await preBillToken(readable.secrets, later);
    const expiredToken = await preBillToken(readable.secrets, earlier);
    const unknown = await postLookup(readable.application, "not-a-link");
    const expired = await postLookup(readable.application, expiredToken);
    const capped = await postLookup(
      limited.application,
      await preBillToken(limited.secrets, later),
    );
    const down = await postLookup(
      failed.application,
      await preBillToken(failed.secrets, later),
    );
    const bodies = [unknown, expired, capped, down].map((response) =>
      response.json(),
    );

    expect(
      [unknown, expired, capped, down].map((response) => response.statusCode),
    ).toEqual([404, 404, 404, 404]);
    expect(bodies).toEqual([{}, {}, {}, {}]);
    expect(JSON.stringify(bodies)).not.toContain(buyerName);
    expect(JSON.stringify(bodies)).not.toContain("expired");
    expect(JSON.stringify(bodies)).not.toContain("limited");
    expect(readable.provider.calls).toEqual([]);
    expect(limited.provider.calls).toEqual([]);
    expect(failed.provider.calls).toEqual(["lookup:1234567890"]);
    expect(readable.store.lookups).toEqual([]);
    expect(live.length).toBeGreaterThan(0);
  } finally {
    await readable.application.close();
    await limited.application.close();
    await failed.application.close();
  }
});

it("given the portal contract, when it is read, then every object schema is strict and z.any is absent", () => {
  expect(contractSource.includes("z.any(")).toBe(false);
  expect(contractSource.includes(".strict()")).toBe(true);
  expect(contractSource.includes("z.strictObject(")).toBe(false);
});
