import { expect, it, vi } from "vitest";

import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  signFast,
} from "#adapters/memory/fast-identity-doubles.js";
import { FastSignatureVerifier } from "#adapters/memory/fast-signature-verifier.js";
import { InMemoryIdentityRepository } from "#adapters/memory/in-memory-identity-repository.js";
import { SiteOffline } from "#application/operate-identity/operate-identity.js";
import {
  BadSignature,
  OperateDevices,
  UnsignedSignature,
} from "#application/operate-devices/operate-devices.js";
import {
  DeviceRevoked,
  Identity,
  RegistrationCodeRejected,
  StationRefused,
} from "#domain/identity.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const GRILL_ID = "organization_station_grill";
const BAR_ID = "organization_station_bar";
const CASHIER_ID = "user_cashier";
const DEVICE_ID = "device_phone_1";
const STATION_DEVICE_ID = "device_grill_tv";
const REGISTRATION_ID = "registration_1";
const SESSION_ID = "session_grill";
const PLAIN_CODE = "shown-once";
const PUBLIC_KEY = "device-public-key";
const STATION_PUBLIC_KEY = "station-public-key";
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

const signedPayload = (command: object): string => {
  const entries = Object.entries(command)
    .filter(([key]) => key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(Object.fromEntries(entries));
};

const withSignature = <T extends { signature: string | null }>(
  command: T,
  publicKey: string,
): T => ({
  ...command,
  signature: signFast(publicKey, signedPayload(command)),
});

const expectNoSecrets = (value: unknown) => {
  const published = JSON.stringify(value);

  expect(published).not.toContain(PLAIN_CODE);
  expect(published).not.toContain(PRIVATE_KEY);
  expect(published).not.toContain("password-hash:");
  expect(published).not.toContain("queue");
};

const userIdentity = async () => {
  const identity = Identity.open(TENANT_ID);

  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: await new FastPasswordHasher().hash("owner-password"),
    pinHash: await new FastPinHasher().hash("1111"),
  });

  return identity;
};

const stationIdentity = async () => {
  const identity = Identity.open(TENANT_ID);

  identity.registerFixedStation({
    id: STATION_DEVICE_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
    displayName: "Grill",
    publicKey: STATION_PUBLIC_KEY,
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
  signatures: FastSignatureVerifier = new FastSignatureVerifier(),
) =>
  new OperateDevices(
    repository,
    new FastPasswordHasher(),
    signatures,
    new FakeClock(ISSUED_AT),
  );

const issueCommand = {
  type: "issueRegistrationCode" as const,
  id: REGISTRATION_ID,
  venueId: VENUE_ID,
  code: PLAIN_CODE,
};

const registerCommand = {
  type: "registerDevice" as const,
  registrationId: REGISTRATION_ID,
  code: PLAIN_CODE,
  deviceId: DEVICE_ID,
  userId: CASHIER_ID,
  venueId: VENUE_ID,
  publicKey: PUBLIC_KEY,
  signature: null,
};

const authorizeCommand = {
  type: "authorizeOperation" as const,
  deviceId: DEVICE_ID,
  stationId: null,
  signature: null,
};

it("given a registration code, when it is issued and the phone signs its registration, then the code is shown once and the public key is stored", async () => {
  const repository = await seed(await userIdentity());
  const signatures = new FastSignatureVerifier();
  const verify = vi.spyOn(signatures, "verify");
  const service = operateWith(repository, signatures);

  const issued = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: issueCommand,
  });

  const signed = withSignature(registerCommand, PUBLIC_KEY);
  const registered = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: signed,
  });

  expect(issued.registrationCode).toBe(PLAIN_CODE);
  expect(issued.event.after.registrationCodes[0]?.expiresAt).toBe(
    ISSUED_AT + FIVE_MINUTES,
  );
  expectNoSecrets(issued.event);
  expect(registered.registrationCode).toBeUndefined();
  expect(registered.event.after.devices).toEqual([
    {
      id: DEVICE_ID,
      venueId: VENUE_ID,
      kind: "personal",
      stationId: null,
      publicKey: PUBLIC_KEY,
      pinAttemptsLocked: false,
      pinFailures: 0,
      revoked: false,
    },
  ]);
  expect(verify).toHaveBeenCalledWith({
    publicKey: PUBLIC_KEY,
    payload: signedPayload(registerCommand),
    signature: signed.signature,
  });
  expect(JSON.parse(String(verify.mock.calls[0]?.[0].payload))).not.toHaveProperty(
    "signature",
  );
  expectNoSecrets(registered.event);
  expect(await repository.eventsFor(TENANT_ID)).toContainEqual(registered.event);
});

it("given an unsigned registration, when the phone redeems a code, then nothing is saved", async () => {
  const repository = await seed(await userIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: issueCommand,
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const redeem = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: registerCommand,
  });

  await expect(redeem).rejects.toThrow(UnsignedSignature);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot().devices).toEqual([]);
});

it("given a bad signature, when the phone redeems a code, then nothing is saved", async () => {
  const repository = await seed(await userIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: issueCommand,
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const redeem = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: { ...registerCommand, signature: "not-the-signature" },
  });

  await expect(redeem).rejects.toThrow(BadSignature);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await repository.load(TENANT_ID))?.snapshot().registrationCodes[0]
      ?.failedRedeems,
  ).toBe(0);
});

it("given a valid signature and a wrong code, when the phone redeems it, then the attempt is saved and registration is refused", async () => {
  const repository = await seed(await userIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: issueCommand,
  });

  const redeem = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(
      { ...registerCommand, code: "wrong-code" },
      PUBLIC_KEY,
    ),
  });

  await expect(redeem).rejects.toThrow(RegistrationCodeRejected);
  expect(
    (await repository.load(TENANT_ID))?.snapshot().registrationCodes[0]
      ?.failedRedeems,
  ).toBe(1);
  expect((await repository.load(TENANT_ID))?.snapshot().devices).toEqual([]);
  expectNoSecrets(await repository.eventsFor(TENANT_ID));
});

it("given a revoked phone, when it authorizes with a valid signature, then nothing is saved", async () => {
  const repository = await seed(await userIdentity());
  const service = operateWith(repository);
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: issueCommand,
  });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(registerCommand, PUBLIC_KEY),
  });
  await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(
      {
        type: "revokeDevice" as const,
        deviceId: DEVICE_ID,
        signature: null,
      },
      PUBLIC_KEY,
    ),
  });
  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const authorize = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(authorizeCommand, PUBLIC_KEY),
  });

  await expect(authorize).rejects.toThrow(DeviceRevoked);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect(
    (await repository.load(TENANT_ID))?.snapshot().devices[0]?.revoked,
  ).toBe(true);
});

it("given a cloud site without internet, when a device command arrives, then nothing is saved", async () => {
  const repository = await seed(await userIdentity());
  const service = operateWith(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const load = vi.spyOn(repository, "load");
  const save = vi.spyOn(repository, "save");

  const authorize = service.execute({
    tenantId: TENANT_ID,
    siteOffline: true,
    command: withSignature(authorizeCommand, PUBLIC_KEY),
  });

  await expect(authorize).rejects.toThrow(SiteOffline);
  expect(load).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given a grill station, when it opens and then asks for the bar, then only the grill session starts and nothing is queued", async () => {
  const repository = await seed(await stationIdentity());
  const service = operateWith(repository);
  const openGrill = {
    type: "openFixedStation" as const,
    deviceId: STATION_DEVICE_ID,
    sessionId: SESSION_ID,
    stationId: GRILL_ID,
    signature: null,
  };

  const opened = await service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(openGrill, STATION_PUBLIC_KEY),
  });

  const recorded = await repository.eventsFor(TENANT_ID);
  const save = vi.spyOn(repository, "save");
  const openBar = service.execute({
    tenantId: TENANT_ID,
    siteOffline: false,
    command: withSignature(
      { ...openGrill, sessionId: "session_bar", stationId: BAR_ID },
      STATION_PUBLIC_KEY,
    ),
  });

  expect(opened.event.after.sessions).toEqual([
    {
      sessionId: SESSION_ID,
      userId: "",
      displayName: "Grill",
      deviceId: STATION_DEVICE_ID,
      venueId: VENUE_ID,
      kind: "station",
    },
  ]);
  expect(Object.keys(opened.event.after.sessions[0] ?? {}).sort()).toEqual(
    SESSION_KEYS,
  );
  expect(JSON.stringify(opened.event)).not.toContain("1111");
  expectNoSecrets(opened.event);
  await expect(openBar).rejects.toThrow(StationRefused);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  expect((await repository.load(TENANT_ID))?.snapshot().sessions).toEqual(
    opened.event.after.sessions,
  );
});
