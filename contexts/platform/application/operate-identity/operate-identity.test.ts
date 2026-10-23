import { expect, it, vi } from "vitest";

import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "#adapters/memory/fast-identity-doubles.js";
import { InMemoryIdentityRepository } from "#adapters/memory/in-memory-identity-repository.js";
import {
  OperateIdentity,
  SessionIdle,
  SiteOffline,
} from "#application/operate-identity/operate-identity.js";
import {
  Identity,
  PasswordRejected,
  PinAttemptsLocked,
  PinRejected,
  SecondFactorRejected,
  SecondFactorRequired,
  type Session,
  UnknownIdentityReference,
  UserDeactivated,
} from "#domain/identity.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const OWNER_ID = "user_owner";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const DEVICE_ID = "device_phone_1";
const REGISTRATION_ID = "registration_1";
const PASSWORD = "owner-password";
const CASHIER_PIN = "1111";
const SUPERVISOR_PIN = "2222";
const WRONG_PIN = "9999";
const FACTOR_CODE = "654321";
const WRONG_FACTOR_CODE = "654320";
const CODE_HASH = "registration-code-hash";
const PUBLIC_KEY = "device-public-key";
const PRIVATE_KEY = "device-private-key";
const ISSUED_AT = 1_700_000_000_000;
const FIVE_MINUTES = 5 * 60 * 1000;

const SESSION_KEYS = [
  "deviceId",
  "displayName",
  "kind",
  "sessionId",
  "userId",
  "venueId",
];

const expectNoSecrets = (value: unknown) => {
  const published = JSON.stringify(value);

  expect(published).not.toContain(PASSWORD);
  expect(published).not.toContain(CASHIER_PIN);
  expect(published).not.toContain(SUPERVISOR_PIN);
  expect(published).not.toContain(WRONG_PIN);
  expect(published).not.toContain(FACTOR_CODE);
  expect(published).not.toContain(WRONG_FACTOR_CODE);
  expect(published).not.toContain(CODE_HASH);
  expect(published).not.toContain(PRIVATE_KEY);
  expect(published).not.toContain("password-hash:");
  expect(published).not.toContain("pin-hash:");
  expect(published).not.toContain("factor-hash:");
};

const expectSession = (
  session: Session | undefined,
  expected: Record<string, string>,
) => {
  expect(session).toEqual(expected);
  expect(Object.keys(session ?? {}).sort()).toEqual(SESSION_KEYS);
};

const ownerIdentity = async () => {
  const identity = Identity.open(TENANT_ID);

  identity.registerUser({
    id: OWNER_ID,
    displayName: "Owner",
    passwordHash: await new FastPasswordHasher().hash(PASSWORD),
    pinHash: await new FastPinHasher().hash(CASHIER_PIN),
  });

  return identity;
};

const staffIdentity = async () => {
  const identity = await ownerIdentity();
  const pins = new FastPinHasher();

  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: await new FastPasswordHasher().hash(PASSWORD),
    pinHash: await pins.hash(CASHIER_PIN),
  });
  identity.registerUser({
    id: SUPERVISOR_ID,
    displayName: "Supervisor",
    passwordHash: await new FastPasswordHasher().hash(PASSWORD),
    pinHash: await pins.hash(SUPERVISOR_PIN),
  });
  identity.issueRegistrationCode({
    id: REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });
  identity.registerDevice({
    registrationId: REGISTRATION_ID,
    codeHash: CODE_HASH,
    deviceId: DEVICE_ID,
    userId: CASHIER_ID,
    venueId: VENUE_ID,
    publicKey: PUBLIC_KEY,
    now: ISSUED_AT,
  });

  return identity;
};

const seed = async (identity: Identity) => {
  const repository = new InMemoryIdentityRepository();
  const snapshot = identity.snapshot();

  await repository.save(identity, { before: snapshot, after: snapshot });

  return repository;
};

const operateWith = (
  repository: InMemoryIdentityRepository,
  options?: {
    clock?: FakeClock;
    passwords?: FastPasswordHasher;
    pins?: FastPinHasher;
    secondFactor?: FastSecondFactor;
  },
) =>
  new OperateIdentity(
    repository,
    options?.passwords ?? new FastPasswordHasher(),
    options?.pins ?? new FastPinHasher(),
    options?.secondFactor ?? new FastSecondFactor(),
    options?.clock ?? new FakeClock(ISSUED_AT),
  );

const pinCommand = (userId: string, pin: string, sessionId: string) => ({
  type: "startPinSession" as const,
  userId,
  deviceId: DEVICE_ID,
  pin,
  sessionId,
  idleLockMs: FIVE_MINUTES,
});

it("given an owner, when they sign in with a password, then an administration session starts and the event omits secrets", async () => {
  const repository = await seed(await ownerIdentity());
  const passwords = new FastPasswordHasher();
  const hash = vi.spyOn(passwords, "hash");
  const service = operateWith(repository, { passwords });

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: PASSWORD,
      factorCode: null,
      sessionId: "session_owner",
    },
  });

  expectSession(event.after.sessions[0], {
    sessionId: "session_owner",
    userId: OWNER_ID,
    displayName: "Owner",
    deviceId: "",
    venueId: "",
    kind: "administration",
  });
  expect(event.before.sessions).toEqual([]);
  expect(hash).toHaveBeenCalledWith(PASSWORD);
  expectNoSecrets(event);
  expect(await repository.eventsFor(TENANT_ID)).toContainEqual(event);
});

it("given an enrolled second factor, when the owner signs in without a code, then no session starts and save is not called", async () => {
  const repository = await seed(await ownerIdentity());
  const service = operateWith(repository);
  const enrolled = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "enrollSecondFactor",
      userId: OWNER_ID,
      code: FACTOR_CODE,
    },
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const signIn = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: PASSWORD,
      factorCode: null,
      sessionId: "session_owner",
    },
  });

  await expect(signIn).rejects.toThrow(SecondFactorRequired);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(enrolled.after.users[0]?.secondFactorEnrolled).toBe(true);
  expect(enrolled.after.sessions).toEqual([]);
  expectNoSecrets(enrolled);
});

it("given an owner, when an administrator requires a second factor, then sign-in with that code starts a session", async () => {
  const repository = await seed(await ownerIdentity());
  const secondFactor = new FastSecondFactor();
  const enroll = vi.spyOn(secondFactor, "enroll");
  const verify = vi.spyOn(secondFactor, "verify");
  const service = operateWith(repository, { secondFactor });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "requireSecondFactor",
      userId: OWNER_ID,
      code: FACTOR_CODE,
    },
  });

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: PASSWORD,
      factorCode: FACTOR_CODE,
      sessionId: "session_owner",
    },
  });

  expect(enroll).toHaveBeenCalledWith(FACTOR_CODE);
  expect(verify).toHaveBeenCalledWith(FACTOR_CODE);
  expectSession(event.after.sessions[0], {
    sessionId: "session_owner",
    userId: OWNER_ID,
    displayName: "Owner",
    deviceId: "",
    venueId: "",
    kind: "administration",
  });
  expectNoSecrets(event);
});

it("given a required second factor, when the code is wrong, then no session starts and the failed attempt is saved", async () => {
  const repository = await seed(await ownerIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "requireSecondFactor",
      userId: OWNER_ID,
      code: FACTOR_CODE,
    },
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const signIn = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: PASSWORD,
      factorCode: WRONG_FACTOR_CODE,
      sessionId: "session_owner",
    },
  });

  await expect(signIn).rejects.toThrow(SecondFactorRejected);
  expect(save).toHaveBeenCalledOnce();
  expect(await repository.eventsFor(TENANT_ID)).toHaveLength(
    recorded.length + 1,
  );
  expect(
    (await repository.load(TENANT_ID))?.snapshot().users[0]
      ?.failedFactorAttempts,
  ).toBe(1);
  expectNoSecrets(await repository.eventsFor(TENANT_ID));
});

it("given a cloud site without internet, when a waiter enters a valid PIN, then no session starts and save is not called", async () => {
  const identity = await staffIdentity();
  const repository = await seed(identity);
  const before = identity.snapshot();
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const start = service.execute({
    tenantId: TENANT_ID,
    siteOffline: true,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });

  await expect(start).rejects.toThrow(SiteOffline);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot()).toEqual(before);
});

it("given an open session while the site is offline, when the user is deactivated, then the session ends and the change is saved", async () => {
  const identity = await staffIdentity();
  identity.startPinSession({
    userId: CASHIER_ID,
    deviceId: DEVICE_ID,
    pinHash: await new FastPinHasher().hash(CASHIER_PIN),
    sessionId: "session_cashier",
  });
  const repository = await seed(identity);
  const service = operateWith(repository);

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: true,
    command: { type: "deactivateUser", userId: CASHIER_ID },
  });

  expect(event.after.sessions).toEqual([]);
  expect(event.after.users.find((user) => user.id === CASHIER_ID)?.active).toBe(
    false,
  );
  expect(event.before.sessions).toHaveLength(1);
  expectNoSecrets(event);
});

it("given no identity for the tenant, when an owner signs in, then the user is denied and save is not called", async () => {
  const repository = new InMemoryIdentityRepository();
  const service = operateWith(repository);
  const save = vi.spyOn(repository, "save");

  const signIn = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: PASSWORD,
      factorCode: null,
      sessionId: "session_owner",
    },
  });

  await expect(signIn).rejects.toThrow(UnknownIdentityReference);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.load(TENANT_ID)).toBeNull();
});

it("given a registered device, when an unregistered user enters a PIN, then the session is denied and save is not called", async () => {
  const identity = await staffIdentity();
  const repository = await seed(identity);
  const before = identity.snapshot();
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const start = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand("user_missing", CASHIER_PIN, "session_missing"),
  });

  await expect(start).rejects.toThrow(UnknownIdentityReference);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot()).toEqual(before);
});

it("given an unregistered device, when a valid PIN is entered, then the session is denied and save is not called", async () => {
  const repository = await seed(await ownerIdentity());
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const start = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(OWNER_ID, CASHIER_PIN, "session_owner"),
  });

  await expect(start).rejects.toThrow(UnknownIdentityReference);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot().sessions).toEqual([]);
  expect((await repository.load(TENANT_ID))?.snapshot().devices).toEqual([]);
});

it("given a cashier session, when a supervisor enters a valid PIN, then the session shows the supervisor name", async () => {
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(SUPERVISOR_ID, SUPERVISOR_PIN, "session_supervisor"),
  });

  expect(event.after.sessions).toHaveLength(1);
  expectSession(event.after.sessions[0], {
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    displayName: "Supervisor",
    deviceId: DEVICE_ID,
    venueId: VENUE_ID,
    kind: "pin",
  });
  expectNoSecrets(event);
});

it("given a waiter phone with a 5-minute lock, when 5 minutes pass without activity, then the PIN is required again and save is not called", async () => {
  const clock = new FakeClock(ISSUED_AT);
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository, { clock });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");
  clock.advance(FIVE_MINUTES);

  const activity = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: { type: "recordActivity", sessionId: "session_cashier" },
  });

  await expect(activity).rejects.toThrow(SessionIdle);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given an idle lock, when the waiter enters a valid PIN, then the session shows their name", async () => {
  const clock = new FakeClock(ISSUED_AT);
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository, { clock });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });
  clock.advance(FIVE_MINUTES);
  await expect(
    service.execute({
      tenantId: TENANT_ID,
      siteOffline: false,
      command: { type: "recordActivity", sessionId: "session_cashier" },
    }),
  ).rejects.toThrow(SessionIdle);

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier_again"),
  });

  expectSession(event.after.sessions[0], {
    sessionId: "session_cashier_again",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: DEVICE_ID,
    venueId: VENUE_ID,
    kind: "pin",
  });
});

it("given a waiter phone with a 5-minute lock, when activity happens before 5 minutes, then the session stays and the change is saved", async () => {
  const clock = new FakeClock(ISSUED_AT);
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository, { clock });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });
  const save = vi.spyOn(repository, "save");
  clock.advance(FIVE_MINUTES - 1);

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: { type: "recordActivity", sessionId: "session_cashier" },
  });

  expect(save).toHaveBeenCalledOnce();
  expectSession(event.after.sessions[0], {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: DEVICE_ID,
    venueId: VENUE_ID,
    kind: "pin",
  });
  clock.advance(FIVE_MINUTES - 1);
  await expect(
    service.execute({
      tenantId: TENANT_ID,
      siteOffline: false,
      command: { type: "recordActivity", sessionId: "session_cashier" },
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      after: expect.objectContaining({
        sessions: [expect.objectContaining({ sessionId: "session_cashier" })],
      }),
    }),
  );
});

it("given five wrong PINs, when the fifth is entered, then PinAttemptsLocked is raised and a later PIN is still refused", async () => {
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository);
  const save = vi.spyOn(repository, "save");
  const wrong = {
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, WRONG_PIN, "session_wrong"),
  };

  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinAttemptsLocked);
  await expect(
    service.execute({
      tenantId: TENANT_ID,
      siteOffline: false,
      command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
    }),
  ).rejects.toThrow(PinAttemptsLocked);
  expect(save).toHaveBeenCalledTimes(5);
  expect(
    (await repository.load(TENANT_ID))?.snapshot().devices[0]
      ?.pinAttemptsLocked,
  ).toBe(true);
  expect((await repository.load(TENANT_ID))?.snapshot().sessions).toEqual([]);
});

it("given three failed PIN attempts, when a valid PIN is entered, then the counter resets and the session starts", async () => {
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository);
  const wrong = {
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, WRONG_PIN, "session_wrong"),
  };
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  await expect(service.execute(wrong)).rejects.toThrow(PinRejected);
  const save = vi.spyOn(repository, "save");

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });

  expect(save).toHaveBeenCalledOnce();
  expect(event.after.devices[0]?.pinAttemptsLocked).toBe(false);
  expectSession(event.after.sessions[0], {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: DEVICE_ID,
    venueId: VENUE_ID,
    kind: "pin",
  });
});

it("given an open PIN session, when the user is deactivated, then that session ends in the same save", async () => {
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });

  const event = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: { type: "deactivateUser", userId: CASHIER_ID },
  });

  expect(event.before.sessions).toHaveLength(1);
  expect(event.after.sessions).toEqual([]);
  expect(event.after.users.find((user) => user.id === CASHIER_ID)?.active).toBe(
    false,
  );
  expect((await repository.load(TENANT_ID))?.snapshot().sessions).toEqual([]);
  expectNoSecrets(event);
});

it("given a deactivated user, when they enter a PIN, then the session is denied and save is not called", async () => {
  const identity = await staffIdentity();
  identity.deactivateUser({ userId: CASHIER_ID });
  const repository = await seed(identity);
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const start = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });

  await expect(start).rejects.toThrow(UserDeactivated);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given an owner, when the password is wrong, then no session starts and save is not called", async () => {
  const identity = await ownerIdentity();
  const repository = await seed(identity);
  const before = identity.snapshot();
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const signIn = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: OWNER_ID,
      password: "wrong-password",
      factorCode: null,
      sessionId: "session_owner",
    },
  });

  await expect(signIn).rejects.toThrow(PasswordRejected);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot()).toEqual(before);
  expectNoSecrets(await repository.eventsFor(TENANT_ID));
});

it("given activity while the site is offline, when the session is still inside the lock window, then save is not called", async () => {
  const clock = new FakeClock(ISSUED_AT);
  const repository = await seed(await staffIdentity());
  const service = operateWith(repository, { clock });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: pinCommand(CASHIER_ID, CASHIER_PIN, "session_cashier"),
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const activity = service.execute({
    tenantId: TENANT_ID,
    siteOffline: true,
    command: { type: "recordActivity", sessionId: "session_cashier" },
  });

  await expect(activity).rejects.toThrow(SiteOffline);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given the application entry port, when it is imported, then it exposes OperateIdentity", async () => {
  const entry = await import("#application/entry-port.js");

  expect(entry.OperateIdentity).toBe(OperateIdentity);
  expect(entry.AcceptCloudWrite).toBeDefined();
  expect(entry.UpdateStructure).toBeDefined();
});
