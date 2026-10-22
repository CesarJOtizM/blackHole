import { expect, it } from "vitest";
import type {
  IdentityChanged,
  IdentityRepository,
} from "#application/ports/identity-repository.js";
import { Identity } from "#domain/identity.js";

export type IdentityRepositorySubject = IdentityRepository & {
  eventsFor(tenantId: string): Promise<readonly IdentityChanged[]>;
};

const PASSWORD_HASH = "password-hash-secret";
const PIN_HASH = "pin-hash-secret";
const FACTOR_HASH = "factor-hash-secret";
const CODE_HASH = "registration-code-hash-secret";
const PUBLIC_KEY = "device-public-key";
const PRIVATE_KEY = "device-private-key";
const ISSUED_AT = 1_700_000_000_000;

const storedIdentity = (suffix: string) => {
  const identity = Identity.open(`tenant_${suffix}`);

  identity.registerUser({
    id: `user_${suffix}`,
    displayName: `Person ${suffix}`,
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.enrollSecondFactor({
    userId: `user_${suffix}`,
    factorHash: FACTOR_HASH,
  });
  identity.issueRegistrationCode({
    id: `registration_${suffix}`,
    venueId: `venue_${suffix}`,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });
  identity.registerDevice({
    registrationId: `registration_${suffix}`,
    codeHash: CODE_HASH,
    deviceId: `device_${suffix}`,
    userId: `user_${suffix}`,
    venueId: `venue_${suffix}`,
    publicKey: PUBLIC_KEY,
    now: ISSUED_AT,
  });
  identity.startPinSession({
    userId: `user_${suffix}`,
    deviceId: `device_${suffix}`,
    pinHash: PIN_HASH,
    sessionId: `session_${suffix}`,
  });

  return identity;
};

const changed = (identity: Identity): IdentityChanged => ({
  before: identity.snapshot(),
  after: identity.snapshot(),
});

const expectNoSecrets = (value: unknown) => {
  const published = JSON.stringify(value);

  expect(published).not.toContain(PASSWORD_HASH);
  expect(published).not.toContain(PIN_HASH);
  expect(published).not.toContain(FACTOR_HASH);
  expect(published).not.toContain(CODE_HASH);
  expect(published).not.toContain(PRIVATE_KEY);
};

export function identityRepositoryContract(
  createRepository: () =>
    | IdentityRepositorySubject
    | Promise<IdentityRepositorySubject>,
): void {
  it("given an identity and its change, when they are saved, then both can be read back", async () => {
    const repository = await createRepository();
    const identity = storedIdentity("saved");
    const event = changed(identity);
    const expected = identity.snapshot();

    await repository.save(identity, event);

    const stored = await repository.load(identity.tenantId);
    expect(stored).toBeInstanceOf(Identity);
    if (!(stored instanceof Identity)) {
      return;
    }
    expect(stored.snapshot()).toEqual(expected);
    expect(await repository.eventsFor(identity.tenantId)).toEqual([event]);
  });

  it("given tenants A and B, when tenant A loads its identity, then B stays hidden", async () => {
    const repository = await createRepository();
    const identityA = storedIdentity("a");
    const identityB = storedIdentity("b");
    const eventA = changed(identityA);
    const eventB = changed(identityB);

    await repository.save(identityA, eventA);
    await repository.save(identityB, eventB);

    const loadedA = await repository.load(identityA.tenantId);
    const loadedB = await repository.load(identityB.tenantId);
    expect(loadedA).toBeInstanceOf(Identity);
    expect(loadedB).toBeInstanceOf(Identity);
    if (!(loadedA instanceof Identity)) {
      return;
    }
    if (!(loadedB instanceof Identity)) {
      return;
    }
    expect(loadedA.snapshot().users.map((user) => user.id)).toEqual(["user_a"]);
    expect(loadedA.snapshot().users.map((user) => user.id)).not.toContain(
      "user_b",
    );
    expect(loadedA.snapshot().devices.map((device) => device.id)).not.toContain(
      "device_b",
    );
    expect(
      loadedA.snapshot().sessions.map((session) => session.sessionId),
    ).not.toContain("session_b");
    expect(loadedB.snapshot()).toEqual(identityB.snapshot());
    expect(await repository.eventsFor(identityA.tenantId)).toEqual([eventA]);
    expect(await repository.eventsFor(identityB.tenantId)).toEqual([eventB]);
    expect(await repository.load("tenant_missing")).toBeNull();
  });

  it("given secrets on the aggregate, when the change is saved, then the event omits them", async () => {
    const repository = await createRepository();
    const identity = storedIdentity("secret");
    const event = changed(identity);

    await repository.save(identity, event);

    expectNoSecrets(await repository.eventsFor(identity.tenantId));
    expectNoSecrets((await repository.load(identity.tenantId))?.snapshot());
  });
}
