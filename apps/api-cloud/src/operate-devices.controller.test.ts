import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
  signFast,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { createApplication } from "#src/create-application.js";

const tenantId = "organization_company_1";
const venueId = "organization_venue_1";
const userId = "user_cashier";
const deviceId = "device_phone_1";
const otherDeviceId = "device_phone_2";
const registrationId = "registration_1";
const plainCode = "shown-once";
const publicKey = "device-public-key";
const issuedAt = 1_700_000_000_000;

const signedPayload = (command: object): string => {
  const entries = Object.entries(command)
    .filter(([key]) => key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(Object.fromEntries(entries));
};

const withSignature = <T extends { signature: string | null }>(
  command: T,
  key: string,
): T => ({
  ...command,
  signature: signFast(key, signedPayload(command)),
});

const issue = {
  siteOffline: false,
  command: {
    type: "issueRegistrationCode",
    id: registrationId,
    venueId,
    code: plainCode,
  },
};

it("given a cashier, when a registration code is posted, then the cloud shows it once and stores the hash", async () => {
  const { application, identities } = await openCloud(await userIdentity());

  try {
    const response = await postDevices(application, issue);

    expect(response.statusCode).toBe(200);
    expect(response.json().registrationCode).toBe(plainCode);
    expect(JSON.stringify(await identities.eventsFor(tenantId))).not.toContain(
      plainCode,
    );
    expect(JSON.stringify(response.json().before)).not.toContain(plainCode);
    expect(JSON.stringify(response.json().after)).not.toContain(plainCode);
    expect(
      (await identities.load(tenantId))?.snapshot().registrationCodes,
    ).toHaveLength(1);
    expect((await identities.load(tenantId))?.snapshot().devices).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a device command with an invalid body, when it is posted, then the response is 400 and nothing is saved", async () => {
  const { application, identities } = await openCloud(await userIdentity());
  const recorded = await identities.eventsFor(tenantId);

  try {
    const response = await postDevices(application, { siteOffline: false });

    expect(response.statusCode).toBe(400);
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect(
      (await identities.load(tenantId))?.snapshot().registrationCodes,
    ).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a used registration code, when it is redeemed again, then the response is 409 and nothing is saved", async () => {
  const { application, identities } = await openCloud(await registeredIdentity());
  const recorded = await identities.eventsFor(tenantId);
  const register = {
    type: "registerDevice" as const,
    registrationId,
    code: plainCode,
    deviceId: otherDeviceId,
    userId,
    venueId,
    publicKey,
    signature: null,
  };

  try {
    const response = await postDevices(application, {
      siteOffline: false,
      command: withSignature(register, publicKey),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "RegistrationCodeReused" });
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect((await identities.load(tenantId))?.snapshot().devices).toHaveLength(
      1,
    );
  } finally {
    await application.close();
  }
});

it("given an unsigned registration, when it is posted, then nothing is saved", async () => {
  const { application, identities } = await openCloud(await codedIdentity());
  const recorded = await identities.eventsFor(tenantId);

  try {
    const response = await postDevices(application, {
      siteOffline: false,
      command: {
        type: "registerDevice",
        registrationId,
        code: plainCode,
        deviceId,
        userId,
        venueId,
        publicKey,
        signature: null,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "UnsignedSignature" });
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect((await identities.load(tenantId))?.snapshot().devices).toEqual([]);
    expect(
      (await identities.load(tenantId))?.snapshot().registrationCodes[0]
        ?.failedRedeems,
    ).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a cloud site without internet, when a device command is posted, then nothing is saved", async () => {
  const { application, identities } = await openCloud(await userIdentity());
  const recorded = await identities.eventsFor(tenantId);

  try {
    const response = await postDevices(application, {
      ...issue,
      siteOffline: true,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "SiteOffline" });
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect(
      (await identities.load(tenantId))?.snapshot().registrationCodes,
    ).toEqual([]);
  } finally {
    await application.close();
  }
});

async function userIdentity() {
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

  identity.registerUser({
    id: userId,
    displayName: "Cashier",
    passwordHash: await passwords.hash("owner-password"),
    pinHash: await new FastPinHasher().hash("1111"),
  });

  return identity;
}

async function codedIdentity() {
  const identity = await userIdentity();

  identity.issueRegistrationCode({
    id: registrationId,
    venueId,
    codeHash: await new FastPasswordHasher().hash(plainCode),
    now: issuedAt,
  });

  return identity;
}

async function registeredIdentity() {
  const identity = await codedIdentity();

  identity.registerDevice({
    registrationId,
    codeHash: await new FastPasswordHasher().hash(plainCode),
    deviceId,
    userId,
    venueId,
    publicKey,
    now: issuedAt,
  });

  return identity;
}

async function openCloud(identity: Identity) {
  const identities = new InMemoryIdentityRepository();
  const snapshot = identity.snapshot();

  await identities.save(identity, { before: snapshot, after: snapshot });

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new FastPasswordHasher(),
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(issuedAt),
    signatures: new FastSignatureVerifier(),
  });

  return { application, identities };
}

function postDevices(
  application: Awaited<ReturnType<typeof createApplication>>,
  command: object,
) {
  return application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/devices`,
    payload: command,
  });
}
