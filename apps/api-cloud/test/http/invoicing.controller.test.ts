import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquirerLookupResult,
  assignNumberingRangeCommand,
  attachBuyerCommand,
  issueCreditNoteCommand,
  lookupAcquirerCommand,
  setDocumentBalanceCommand,
} from "@blackhole/contracts";
import {
  ACQUIRER_LOOKUP,
  type AcquirerLookup,
  type AcquirerQuery,
  type CreditNoteValidation,
  InvoicingProvider,
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
import { expect, it } from "vitest";
import {
  MemoryCreditNoteAudit,
  MemoryCreditNotes,
  MemoryDocumentBalances,
  MemoryNumberingRanges,
} from "#src/composition/application-module.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  InvoicingController,
  routePermissions,
} from "#src/http/invoicing.controller.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const ownerId = "user_owner";
const cashierId = "user_cashier";
const kitchenChiefId = "user_kitchen";
const managerId = "user_manager";
const sessionHeader = "x-session-id";
const closureId = "closure_front_1";
const buyerName = "Ada Buyer";
const buyerEmail = "ada@buyer.example";
const taxpayerEmail = "facturas@taxpayer.example";
const nit = "890903938-8";
const badNit = "890903938-7";
const numberingRangeId = "range_site";
const registerId = "organization_register_front";
const noteReference = "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20";
const originalReference = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const prefix = `/tenants/${tenantId}/venues/${venueId}`;

const people = [
  [ownerId, "session_owner", "owner"],
  [cashierId, "session_cashier", "cashier"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
  [managerId, "session_manager", "generalManager"],
] as const;

const lookupBody = {
  documentType: "13",
  documentNumber: "1234567890",
};

const buyerBody = {
  taxpayerEmail,
  documentType: "13",
  documentNumber: "1234567890",
};

const balanceBody = {
  nit,
  remaining: 40,
};

const rangeBody = {
  numberingRangeId,
  registerId,
};

const noteBody = {
  closureId,
  referenceCode: noteReference,
  originalReferenceCode: originalReference,
  taxpayerEmail,
  reason: "Customer return",
};

class CountingInvoicingProvider extends InvoicingProvider {
  readonly lookups: AcquirerQuery[] = [];
  readonly creditNotes: CreditNoteValidation[] = [];

  override async validate(): Promise<void> {
    return undefined;
  }

  override async lookupAcquirer(query: AcquirerQuery): Promise<AcquirerLookup> {
    this.lookups.push({ ...query });

    return {
      outcome: ACQUIRER_LOOKUP.FOUND,
      name: buyerName,
      email: buyerEmail,
    };
  }

  override async validateCreditNote(note: CreditNoteValidation): Promise<void> {
    this.creditNotes.push({ ...note });
  }
}

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const provider = new CountingInvoicingProvider();
  const balances = new MemoryDocumentBalances();
  const notes = new MemoryCreditNotes();
  const audits = new MemoryCreditNoteAudit(notes);
  const ranges = new MemoryNumberingRanges();

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
    documentBalances: balances,
    creditNotes: notes,
    creditNoteAudits: audits,
    numberingRanges: ranges,
  });

  return { application, provider, balances, notes, audits, ranges };
};

type Cloud = Awaited<ReturnType<typeof openCloud>>;

const postJson = (
  application: NestFastifyApplication,
  url: string,
  sessionId: string | null,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url,
    headers: sessionId === null ? {} : { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const storedNothing = (cloud: Cloud) => {
  expect(cloud.provider.lookups).toEqual([]);
  expect(cloud.provider.creditNotes).toEqual([]);
  expect(cloud.balances.saves).toBe(0);
  expect(cloud.ranges.saves).toBe(0);
  expect(cloud.notes.rows).toEqual([]);
  expect(cloud.audits.calls).toEqual([]);
};

const contractSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../shared/contracts/e-invoicing.ts",
  ),
  "utf8",
);

it("given a cashier session, when POST acquirers/lookup is injected, then the response is 200 and the route requires sale.charge", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST acquirers/lookup"]).toBe("sale.charge");
    expect(routePermissions["POST closures/:closureId/buyer"]).toBe(
      "sale.charge",
    );
    expect(cloud.application.get(InvoicingController)).toBeInstanceOf(
      InvoicingController,
    );

    const response = await postJson(
      cloud.application,
      `${prefix}/acquirers/lookup`,
      "session_cashier",
      lookupBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "found",
      name: buyerName,
      email: buyerEmail,
    });
    expect(acquirerLookupResult.parse(response.json())).toEqual(
      response.json(),
    );
    expect(cloud.provider.lookups).toEqual([lookupBody]);
    expect(cloud.balances.saves).toBe(0);
    expect(cloud.ranges.saves).toBe(0);
    expect(cloud.notes.rows).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given a cashier session, when POST closures/:closureId/buyer sends an acquirer, then the response is 200 with the looked-up name and email", async () => {
  const cloud = await openCloud();

  try {
    const response = await postJson(
      cloud.application,
      `${prefix}/closures/${closureId}/buyer`,
      "session_cashier",
      buyerBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kind: "identified",
      buyer: {
        documentType: "13",
        documentNumber: "1234567890",
        name: buyerName,
      },
      lookup: { name: buyerName, email: buyerEmail },
    });
    expect(cloud.provider.lookups).toEqual([
      { documentType: "13", documentNumber: "1234567890" },
    ]);
    expect(cloud.notes.rows).toEqual([]);
    expect(cloud.balances.saves).toBe(0);
  } finally {
    await cloud.application.close();
  }
});

it("given a cashier session without customer data, when POST buyer is injected, then the buyer is the final consumer and the provider is not called", async () => {
  const cloud = await openCloud();

  try {
    const response = await postJson(
      cloud.application,
      `${prefix}/closures/${closureId}/buyer`,
      "session_cashier",
      { taxpayerEmail },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kind: "generic",
      buyer: {
        documentType: "13",
        documentNumber: "222222222222",
        name: "Consumidor final",
        responsibility: "R-99-PN",
        email: taxpayerEmail,
      },
    });
    expect(cloud.provider.lookups).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given an owner session, when POST document-balance sets the remaining documents, then the response is 200 and that balance is stored", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST document-balance"]).toBe("tax.configure");

    const response = await postJson(
      cloud.application,
      `${prefix}/document-balance`,
      "session_owner",
      balanceBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      companyId: tenantId,
      nit,
      siteId: venueId,
      remaining: 40,
    });
    expect(cloud.balances.saved).toEqual([
      {
        companyId: tenantId,
        nit,
        siteId: venueId,
        remaining: 40,
      },
    ]);
    expect(cloud.provider.lookups).toEqual([]);
    expect(cloud.notes.rows).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given an owner session, when POST numbering-ranges assigns a register range, then the response is 200 and that range is stored", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST numbering-ranges"]).toBe("tax.configure");

    const response = await postJson(
      cloud.application,
      `${prefix}/numbering-ranges`,
      "session_owner",
      rangeBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId,
      venueId,
      numberingRangeId,
      registerId,
    });
    expect(cloud.ranges.rows).toEqual([
      {
        tenantId,
        venueId,
        numberingRangeId,
        registerId,
      },
    ]);
    expect(cloud.balances.saves).toBe(0);
  } finally {
    await cloud.application.close();
  }
});

it("given a general manager session, when POST credit-notes cites an original, then the response is 200 and the note is stored after the provider accepts it", async () => {
  const cloud = await openCloud();

  try {
    expect(routePermissions["POST credit-notes"]).toBe("sale.credit-note");

    const response = await postJson(
      cloud.application,
      `${prefix}/credit-notes`,
      "session_manager",
      noteBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "issued",
      note: {
        referenceCode: noteReference,
        originalReferenceCode: originalReference,
        status: "generated",
      },
    });
    expect(cloud.provider.creditNotes).toEqual([
      {
        referenceCode: noteReference,
        originalReferenceCode: originalReference,
      },
    ]);
    expect(cloud.notes.rows).toEqual([
      {
        referenceCode: noteReference,
        originalReferenceCode: originalReference,
        status: "generated",
      },
    ]);
    expect(cloud.audits.calls).toHaveLength(1);
    expect(cloud.audits.storedBeforeRecord).toEqual([1]);
    expect(cloud.provider.lookups).toEqual([]);
  } finally {
    await cloud.application.close();
  }
});

it("given a kitchen chief session, when lookup and buyer are injected, then the response is 403 and nothing is stored", async () => {
  const cloud = await openCloud();

  try {
    const lookup = await postJson(
      cloud.application,
      `${prefix}/acquirers/lookup`,
      "session_kitchen",
      lookupBody,
    );
    const buyer = await postJson(
      cloud.application,
      `${prefix}/closures/${closureId}/buyer`,
      "session_kitchen",
      buyerBody,
    );

    expect(lookup.statusCode).toBe(403);
    expect(lookup.json()).toEqual({ error: "SaleChargeDenied" });
    expect(buyer.statusCode).toBe(403);
    expect(buyer.json()).toEqual({ error: "SaleChargeDenied" });
    storedNothing(cloud);
  } finally {
    await cloud.application.close();
  }
});

it("given a cashier session, when balance, numbering ranges, and credit notes are injected, then the response is 403 and nothing is stored", async () => {
  const cloud = await openCloud();

  try {
    const balance = await postJson(
      cloud.application,
      `${prefix}/document-balance`,
      "session_cashier",
      balanceBody,
    );
    const ranges = await postJson(
      cloud.application,
      `${prefix}/numbering-ranges`,
      "session_cashier",
      rangeBody,
    );
    const notes = await postJson(
      cloud.application,
      `${prefix}/credit-notes`,
      "session_cashier",
      noteBody,
    );

    expect(balance.statusCode).toBe(403);
    expect(balance.json()).toEqual({ error: "TaxConfigureDenied" });
    expect(ranges.statusCode).toBe(403);
    expect(ranges.json()).toEqual({ error: "TaxConfigureDenied" });
    expect(notes.statusCode).toBe(403);
    expect(notes.json()).toEqual({ error: "SaleCreditNoteDenied" });
    storedNothing(cloud);
  } finally {
    await cloud.application.close();
  }
});

it("given an allowed session, when the body is invalid or the session header is missing, then the response is 400 and nothing is stored", async () => {
  const cloud = await openCloud();

  try {
    const missingHeader = await postJson(
      cloud.application,
      `${prefix}/acquirers/lookup`,
      null,
      lookupBody,
    );
    const badLookup = await postJson(
      cloud.application,
      `${prefix}/acquirers/lookup`,
      "session_cashier",
      { ...lookupBody, occurredAt: "2026-10-30" },
    );
    const badBuyer = await postJson(
      cloud.application,
      `${prefix}/closures/${closureId}/buyer`,
      "session_cashier",
      { taxpayerEmail: "not-an-email" },
    );
    const badDigit = await postJson(
      cloud.application,
      `${prefix}/closures/${closureId}/buyer`,
      "session_cashier",
      {
        taxpayerEmail,
        documentType: "31",
        documentNumber: badNit,
      },
    );
    const badBalance = await postJson(
      cloud.application,
      `${prefix}/document-balance`,
      "session_owner",
      {},
    );
    const badRange = await postJson(
      cloud.application,
      `${prefix}/numbering-ranges`,
      "session_owner",
      { numberingRangeId, registerId, occurredAt: "2026-10-30" },
    );
    const badNote = await postJson(
      cloud.application,
      `${prefix}/credit-notes`,
      "session_manager",
      { ...noteBody, taxpayerEmail: "not-an-email" },
    );

    expect(missingHeader.statusCode).toBe(400);
    expect(badLookup.statusCode).toBe(400);
    expect(badBuyer.statusCode).toBe(400);
    expect(badDigit.statusCode).toBe(400);
    expect(badDigit.json()).toEqual({ error: "InvalidNitCheckDigit" });
    expect(badBalance.statusCode).toBe(400);
    expect(badRange.statusCode).toBe(400);
    expect(badNote.statusCode).toBe(400);
    storedNothing(cloud);
  } finally {
    await cloud.application.close();
  }
});

it("given an invoicing contract, when an email is invalid or an unknown key is present, then the strict schema rejects it and does not use z.any()", () => {
  expect(contractSource).toContain("z.email(");
  expect(contractSource).not.toContain("z.any(");
  expect(contractSource).toContain(".strict()");
  expect(
    lookupAcquirerCommand.safeParse({ ...lookupBody, occurredAt: "today" })
      .success,
  ).toBe(false);
  expect(
    attachBuyerCommand.safeParse({ taxpayerEmail: "not-an-email" }).success,
  ).toBe(false);
  expect(attachBuyerCommand.safeParse({ taxpayerEmail }).success).toBe(true);
  expect(
    setDocumentBalanceCommand.safeParse({ ...balanceBody, extra: true })
      .success,
  ).toBe(false);
  expect(
    assignNumberingRangeCommand.safeParse({ numberingRangeId }).success,
  ).toBe(true);
  expect(
    issueCreditNoteCommand.safeParse({
      ...noteBody,
      taxpayerEmail: "not-an-email",
    }).success,
  ).toBe(false);
  expect(
    acquirerLookupResult.safeParse({
      outcome: "found",
      name: buyerName,
      email: "not-an-email",
    }).success,
  ).toBe(false);
});
