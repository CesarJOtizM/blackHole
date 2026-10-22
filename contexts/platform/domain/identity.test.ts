import { expect, it } from "vitest";

import {
  Identity,
  InvalidIdentityId,
  PinAttemptsLocked,
  PinRejected,
  RegistrationCodeExpired,
  RegistrationCodeLocked,
  RegistrationCodeRejected,
  RegistrationCodeReused,
  SecondFactorRejected,
  SecondFactorRequired,
  StationRefused,
  UserDeactivated,
} from "#domain/identity.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const GRILL_ID = "organization_station_grill";
const BAR_ID = "organization_station_bar";
const OWNER_ID = "user_owner";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const DEVICE_ID = "device_phone_1";
const OTHER_DEVICE_ID = "device_phone_2";
const STATION_DEVICE_ID = "device_grill_tv";
const REGISTRATION_ID = "registration_1";
const OTHER_REGISTRATION_ID = "registration_2";
const PASSWORD_HASH = "password-hash";
const PIN_HASH = "cashier-pin-hash";
const SUPERVISOR_PIN_HASH = "supervisor-pin-hash";
const FACTOR_HASH = "factor-hash";
const WRONG_FACTOR_HASH = "wrong-factor-hash";
const CODE_HASH = "registration-code-hash";
const OTHER_CODE_HASH = "registration-code-hash-2";
const WRONG_CODE_HASH = "wrong-registration-code-hash";
const WRONG_PIN_HASH = "wrong-pin-hash";
const PUBLIC_KEY = "device-public-key";
const OTHER_PUBLIC_KEY = "device-public-key-2";
const STATION_PUBLIC_KEY = "station-public-key";
const PRIVATE_KEY = "device-private-key";
const ISSUED_AT = 1_700_000_000_000;
const FIVE_MINUTES = 5 * 60 * 1000;

const openStaffIdentity = () => {
  const identity = Identity.open(TENANT_ID);

  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.registerUser({
    id: SUPERVISOR_ID,
    displayName: "Supervisor",
    passwordHash: PASSWORD_HASH,
    pinHash: SUPERVISOR_PIN_HASH,
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

const personalDevice = (pinAttemptsLocked: boolean) => ({
  id: DEVICE_ID,
  venueId: VENUE_ID,
  kind: "personal",
  stationId: null,
  publicKey: PUBLIC_KEY,
  pinAttemptsLocked,
  pinFailures: pinAttemptsLocked ? 5 : 0,
});

it("given an owner who enrolls a second factor, when they sign in without it, then no new administration session starts", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: OWNER_ID,
    displayName: "Owner",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  const session = identity.signInAdministration({
    userId: OWNER_ID,
    passwordHash: PASSWORD_HASH,
    factorHash: null,
    sessionId: "session_owner",
  });
  identity.enrollSecondFactor({
    userId: OWNER_ID,
    factorHash: FACTOR_HASH,
  });

  const signInWithoutFactor = () => {
    identity.signInAdministration({
      userId: OWNER_ID,
      passwordHash: PASSWORD_HASH,
      factorHash: null,
      sessionId: "session_owner_again",
    });
  };

  expect(signInWithoutFactor).toThrow(SecondFactorRequired);
  expect(identity.snapshot().sessions).toEqual([session]);
  expect(identity.snapshot().users[0]).toEqual({
    id: OWNER_ID,
    displayName: "Owner",
    active: true,
    secondFactorEnrolled: true,
    failedFactorAttempts: 0,
  });
  expect(session).toEqual({
    sessionId: "session_owner",
    userId: OWNER_ID,
    displayName: "Owner",
    deviceId: "",
    venueId: "",
    kind: "administration",
  });
});

it("given an owner with a second factor enrolled, when the code is wrong, then no session starts and the attempt is recorded", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: OWNER_ID,
    displayName: "Owner",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.enrollSecondFactor({
    userId: OWNER_ID,
    factorHash: FACTOR_HASH,
  });

  const signInWithWrongFactor = () => {
    identity.signInAdministration({
      userId: OWNER_ID,
      passwordHash: PASSWORD_HASH,
      factorHash: WRONG_FACTOR_HASH,
      sessionId: "session_owner",
    });
  };

  expect(signInWithWrongFactor).toThrow(SecondFactorRejected);
  expect(identity.snapshot().sessions).toEqual([]);
  expect(identity.snapshot().users[0]?.failedFactorAttempts).toBe(1);
});

it("given five wrong PINs on one device, when the fifth is entered, then PinAttemptsLocked is raised and a later PIN is refused", () => {
  const identity = openStaffIdentity();

  const rejectWrongPin = () => {
    identity.startPinSession({
      userId: CASHIER_ID,
      deviceId: DEVICE_ID,
      pinHash: WRONG_PIN_HASH,
      sessionId: "session_wrong_pin",
    });
  };
  const startWithCorrectPin = () => {
    identity.startPinSession({
      userId: CASHIER_ID,
      deviceId: DEVICE_ID,
      pinHash: PIN_HASH,
      sessionId: "session_cashier",
    });
  };

  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinAttemptsLocked);
  expect(startWithCorrectPin).toThrow(PinAttemptsLocked);
  expect(identity.snapshot().sessions).toEqual([]);
  expect(identity.snapshot().devices).toEqual([personalDevice(true)]);
});

it("given a cashier session and failed PIN attempts, when a supervisor enters a valid PIN, then that session is replaced and the counter resets", () => {
  const identity = openStaffIdentity();
  const cashierSession = identity.startPinSession({
    userId: CASHIER_ID,
    deviceId: DEVICE_ID,
    pinHash: PIN_HASH,
    sessionId: "session_cashier",
  });

  const rejectWrongPin = () => {
    identity.startPinSession({
      userId: CASHIER_ID,
      deviceId: DEVICE_ID,
      pinHash: WRONG_PIN_HASH,
      sessionId: "session_wrong_pin",
    });
  };

  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(identity.snapshot().sessions).toEqual([cashierSession]);

  const supervisorSession = identity.startPinSession({
    userId: SUPERVISOR_ID,
    deviceId: DEVICE_ID,
    pinHash: SUPERVISOR_PIN_HASH,
    sessionId: "session_supervisor",
  });

  expect(supervisorSession).toEqual({
    sessionId: "session_supervisor",
    userId: SUPERVISOR_ID,
    displayName: "Supervisor",
    deviceId: DEVICE_ID,
    venueId: VENUE_ID,
    kind: "pin",
  });
  expect(identity.snapshot().sessions).toEqual([supervisorSession]);
  expect(identity.snapshot().devices[0]?.pinFailures).toBe(0);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(rejectWrongPin).toThrow(PinRejected);
  expect(identity.snapshot().sessions).toEqual([supervisorSession]);
  expect(identity.snapshot().devices).toEqual([
    { ...personalDevice(false), pinFailures: 4 },
  ]);
});

it("given a registration code hash, when the code is issued, then it expires five minutes later and the snapshot omits the hash", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });

  const issued = identity.issueRegistrationCode({
    id: REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });

  expect(issued).toEqual({
    id: REGISTRATION_ID,
    expiresAt: ISSUED_AT + FIVE_MINUTES,
  });
  expect(JSON.stringify(issued)).not.toContain(CODE_HASH);
  expect(identity.snapshot().registrationCodes).toEqual([
    {
      id: REGISTRATION_ID,
      venueId: VENUE_ID,
      expiresAt: ISSUED_AT + FIVE_MINUTES,
      locked: false,
      used: false,
    },
  ]);
  expect(JSON.stringify(identity.snapshot())).not.toContain(CODE_HASH);

  identity.registerDevice({
    registrationId: REGISTRATION_ID,
    codeHash: CODE_HASH,
    deviceId: DEVICE_ID,
    userId: CASHIER_ID,
    venueId: VENUE_ID,
    publicKey: PUBLIC_KEY,
    now: ISSUED_AT + FIVE_MINUTES - 1,
  });

  expect(identity.snapshot().devices).toEqual([personalDevice(false)]);
  expect(identity.snapshot().registrationCodes[0]?.used).toBe(true);

  const expired = Identity.open(TENANT_ID);
  expired.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  expired.issueRegistrationCode({
    id: REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });

  const redeemExpired = () => {
    expired.registerDevice({
      registrationId: REGISTRATION_ID,
      codeHash: CODE_HASH,
      deviceId: DEVICE_ID,
      userId: CASHIER_ID,
      venueId: VENUE_ID,
      publicKey: PUBLIC_KEY,
      now: ISSUED_AT + FIVE_MINUTES,
    });
  };

  expect(redeemExpired).toThrow(RegistrationCodeExpired);
  expect(expired.snapshot().devices).toEqual([]);
  expect(expired.snapshot().registrationCodes[0]?.used).toBe(false);
});

it("given five wrong registration redeems, when the fifth is entered, then the code locks and the real hash is refused", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.issueRegistrationCode({
    id: REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });

  const redeemWrong = () => {
    identity.registerDevice({
      registrationId: REGISTRATION_ID,
      codeHash: WRONG_CODE_HASH,
      deviceId: DEVICE_ID,
      userId: CASHIER_ID,
      venueId: VENUE_ID,
      publicKey: PUBLIC_KEY,
      now: ISSUED_AT,
    });
  };
  const redeemReal = () => {
    identity.registerDevice({
      registrationId: REGISTRATION_ID,
      codeHash: CODE_HASH,
      deviceId: DEVICE_ID,
      userId: CASHIER_ID,
      venueId: VENUE_ID,
      publicKey: PUBLIC_KEY,
      now: ISSUED_AT,
    });
  };

  expect(redeemWrong).toThrow(RegistrationCodeRejected);
  expect(redeemWrong).toThrow(RegistrationCodeRejected);
  expect(redeemWrong).toThrow(RegistrationCodeRejected);
  expect(redeemWrong).toThrow(RegistrationCodeRejected);
  expect(redeemWrong).toThrow(RegistrationCodeLocked);
  expect(redeemReal).toThrow(RegistrationCodeLocked);
  expect(identity.snapshot().devices).toEqual([]);
  expect(identity.snapshot().registrationCodes).toEqual([
    {
      id: REGISTRATION_ID,
      venueId: VENUE_ID,
      expiresAt: ISSUED_AT + FIVE_MINUTES,
      locked: true,
      used: false,
    },
  ]);
});

it("given a registration code already redeemed, when it is redeemed again, then reuse is refused", () => {
  const identity = openStaffIdentity();
  const before = identity.snapshot();

  const redeemAgain = () => {
    identity.registerDevice({
      registrationId: REGISTRATION_ID,
      codeHash: CODE_HASH,
      deviceId: OTHER_DEVICE_ID,
      userId: CASHIER_ID,
      venueId: VENUE_ID,
      publicKey: OTHER_PUBLIC_KEY,
      now: ISSUED_AT,
    });
  };

  expect(redeemAgain).toThrow(RegistrationCodeReused);
  expect(identity.snapshot()).toEqual(before);
});

it("given a TV registered as the grill station, when it opens, then the grill session starts without a PIN and the bar station is refused", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: CASHIER_ID,
    displayName: "Cashier",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.registerFixedStation({
    id: STATION_DEVICE_ID,
    venueId: VENUE_ID,
    stationId: GRILL_ID,
    displayName: "Grill",
    publicKey: STATION_PUBLIC_KEY,
  });

  const session = identity.openFixedStation({
    deviceId: STATION_DEVICE_ID,
    sessionId: "session_grill",
    stationId: GRILL_ID,
  });

  expect(session).toEqual({
    sessionId: "session_grill",
    userId: "",
    displayName: "Grill",
    deviceId: STATION_DEVICE_ID,
    venueId: VENUE_ID,
    kind: "station",
  });
  expect(identity.snapshot().devices).toEqual([
    {
      id: STATION_DEVICE_ID,
      venueId: VENUE_ID,
      kind: "fixed-station",
      stationId: GRILL_ID,
      publicKey: STATION_PUBLIC_KEY,
      pinAttemptsLocked: false,
      pinFailures: 0,
    },
  ]);

  const openBar = () => {
    identity.openFixedStation({
      deviceId: STATION_DEVICE_ID,
      sessionId: "session_bar",
      stationId: BAR_ID,
    });
  };
  const startWithPin = () => {
    identity.startPinSession({
      userId: CASHIER_ID,
      deviceId: STATION_DEVICE_ID,
      pinHash: PIN_HASH,
      sessionId: "session_pin_on_station",
    });
  };

  expect(openBar).toThrow(StationRefused);
  expect(startWithPin).toThrow(StationRefused);
  expect(identity.snapshot().sessions).toEqual([session]);
});

it("given a user with open sessions, when the user is deactivated, then those sessions end and a later PIN is denied", () => {
  const identity = openStaffIdentity();
  identity.signInAdministration({
    userId: CASHIER_ID,
    passwordHash: PASSWORD_HASH,
    factorHash: null,
    sessionId: "session_cashier_admin",
  });
  identity.startPinSession({
    userId: CASHIER_ID,
    deviceId: DEVICE_ID,
    pinHash: PIN_HASH,
    sessionId: "session_cashier",
  });
  identity.issueRegistrationCode({
    id: OTHER_REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: OTHER_CODE_HASH,
    now: ISSUED_AT,
  });
  identity.registerDevice({
    registrationId: OTHER_REGISTRATION_ID,
    codeHash: OTHER_CODE_HASH,
    deviceId: OTHER_DEVICE_ID,
    userId: SUPERVISOR_ID,
    venueId: VENUE_ID,
    publicKey: OTHER_PUBLIC_KEY,
    now: ISSUED_AT,
  });
  const supervisorSession = identity.startPinSession({
    userId: SUPERVISOR_ID,
    deviceId: OTHER_DEVICE_ID,
    pinHash: SUPERVISOR_PIN_HASH,
    sessionId: "session_supervisor",
  });

  identity.deactivateUser({ userId: CASHIER_ID });

  expect(identity.snapshot().sessions).toEqual([supervisorSession]);
  expect(identity.snapshot().users[0]).toEqual({
    id: CASHIER_ID,
    displayName: "Cashier",
    active: false,
    secondFactorEnrolled: false,
    failedFactorAttempts: 0,
  });

  const startCashierPin = () => {
    identity.startPinSession({
      userId: CASHIER_ID,
      deviceId: OTHER_DEVICE_ID,
      pinHash: PIN_HASH,
      sessionId: "session_cashier_again",
    });
  };

  expect(startCashierPin).toThrow(UserDeactivated);
  expect(identity.snapshot().sessions).toEqual([supervisorSession]);
});

it("given secrets supplied to an identity, when its snapshot and sessions are read, then PINs, passwords, hashes, and private keys are absent", () => {
  const identity = Identity.open(TENANT_ID);
  identity.registerUser({
    id: OWNER_ID,
    displayName: "Owner",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });
  identity.enrollSecondFactor({
    userId: OWNER_ID,
    factorHash: FACTOR_HASH,
  });
  const issued = identity.issueRegistrationCode({
    id: REGISTRATION_ID,
    venueId: VENUE_ID,
    codeHash: CODE_HASH,
    now: ISSUED_AT,
  });
  identity.registerDevice({
    registrationId: REGISTRATION_ID,
    codeHash: CODE_HASH,
    deviceId: DEVICE_ID,
    userId: OWNER_ID,
    venueId: VENUE_ID,
    publicKey: PUBLIC_KEY,
    now: ISSUED_AT,
  });
  const administration = identity.signInAdministration({
    userId: OWNER_ID,
    passwordHash: PASSWORD_HASH,
    factorHash: FACTOR_HASH,
    sessionId: "session_owner",
  });
  const pin = identity.startPinSession({
    userId: OWNER_ID,
    deviceId: DEVICE_ID,
    pinHash: PIN_HASH,
    sessionId: "session_owner_pin",
  });

  const published = JSON.stringify({
    issued,
    administration,
    pin,
    snapshot: identity.snapshot(),
  });

  expect(published).not.toContain(PASSWORD_HASH);
  expect(published).not.toContain(PIN_HASH);
  expect(published).not.toContain(FACTOR_HASH);
  expect(published).not.toContain(CODE_HASH);
  expect(published).not.toContain(PRIVATE_KEY);
  expect(published).not.toContain(WRONG_PIN_HASH);
  expect(Object.keys(administration).sort()).toEqual([
    "deviceId",
    "displayName",
    "kind",
    "sessionId",
    "userId",
    "venueId",
  ]);
  expect(Object.keys(pin).sort()).toEqual([
    "deviceId",
    "displayName",
    "kind",
    "sessionId",
    "userId",
    "venueId",
  ]);
});

it("given an identity, when an identifier omits its prefix, then it is rejected and nothing is stored", () => {
  const identity = Identity.open(TENANT_ID);
  const before = identity.snapshot();

  const registerUser = () => {
    identity.registerUser({
      id: "owner",
      displayName: "Owner",
      passwordHash: PASSWORD_HASH,
      pinHash: PIN_HASH,
    });
  };
  const issueCode = () => {
    identity.issueRegistrationCode({
      id: "code-1",
      venueId: VENUE_ID,
      codeHash: CODE_HASH,
      now: ISSUED_AT,
    });
  };
  const registerStation = () => {
    identity.registerFixedStation({
      id: "grill-tv",
      venueId: VENUE_ID,
      stationId: GRILL_ID,
      displayName: "Grill",
      publicKey: STATION_PUBLIC_KEY,
    });
  };

  expect(registerUser).toThrow(InvalidIdentityId);
  expect(issueCode).toThrow(InvalidIdentityId);
  expect(registerStation).toThrow(InvalidIdentityId);
  expect(identity.snapshot()).toEqual(before);

  identity.registerUser({
    id: OWNER_ID,
    displayName: "Owner",
    passwordHash: PASSWORD_HASH,
    pinHash: PIN_HASH,
  });

  const signIn = () => {
    identity.signInAdministration({
      userId: OWNER_ID,
      passwordHash: PASSWORD_HASH,
      factorHash: null,
      sessionId: "admin-session",
    });
  };

  expect(signIn).toThrow(InvalidIdentityId);
  expect(identity.snapshot().sessions).toEqual([]);
});
