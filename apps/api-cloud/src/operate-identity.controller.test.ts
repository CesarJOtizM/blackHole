import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Identity } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { createApplication } from "#src/create-application.js";
import { authorizationDependencies } from "#src/authorization-access.js";

const tenantId = "organization_company_1";
const userId = "user_owner";
const sessionId = "session_owner";
const password = "owner-password";
const sessionHeader = "x-session-id";
const sessionKeys = [
  "deviceId",
  "displayName",
  "kind",
  "sessionId",
  "userId",
  "venueId",
];

const signIn = {
  siteOffline: false,
  command: {
    type: "signInAdministration",
    userId,
    password,
    factorCode: null,
    sessionId,
  },
};

it("given an owner, when signInAdministration is posted with x-session-id, then the cloud starts a session with six keys", async () => {
  const { application, identities } = await openCloud();

  try {
    const response = await postIdentity(application, signIn);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json().after.sessions[0]).sort()).toEqual(
      sessionKeys,
    );
    expect(response.json().after.sessions).toEqual([
      {
        sessionId,
        userId,
        displayName: "Owner",
        deviceId: "",
        venueId: "",
        kind: "administration",
      },
    ]);
    expect(
      (await identities.load(tenantId))?.snapshot().sessions,
    ).toHaveLength(1);
    expect(await identities.eventsFor(tenantId)).toHaveLength(2);
  } finally {
    await application.close();
  }
});

it("given an identity command with an invalid body, when it is posted, then the response is 400 and nothing is saved", async () => {
  const { application, identities } = await openCloud();
  const recorded = await identities.eventsFor(tenantId);

  try {
    const response = await postIdentity(application, {
      siteOffline: false,
      command: { type: "signInAdministration", userId },
    });

    expect(response.statusCode).toBe(400);
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect((await identities.load(tenantId))?.snapshot().sessions).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner, when the password is wrong, then the response is 409 and nothing is saved", async () => {
  const { application, identities } = await openCloud();
  const recorded = await identities.eventsFor(tenantId);

  try {
    const response = await postIdentity(application, {
      siteOffline: false,
      command: {
        type: "signInAdministration",
        userId,
        password: "wrong-password",
        factorCode: null,
        sessionId,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "PasswordRejected" });
    expect(await identities.eventsFor(tenantId)).toEqual(recorded);
    expect((await identities.load(tenantId))?.snapshot().sessions).toEqual([]);
  } finally {
    await application.close();
  }
});

async function openCloud() {
  const identities = new InMemoryIdentityRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

  identity.registerUser({
    id: userId,
    displayName: "Owner",
    passwordHash: await passwords.hash(password),
    pinHash: await new FastPinHasher().hash("1111"),
  });
  const snapshot = identity.snapshot();
  await identities.save(identity, { before: snapshot, after: snapshot });

  const clock = new FakeClock(1_700_000_000_000);
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
  });

  return { application, identities };
}

function postIdentity(
  application: Awaited<ReturnType<typeof createApplication>>,
  command: object,
) {
  return application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/identity`,
    headers: {
      [sessionHeader]: sessionId,
    },
    payload: command,
  });
}
