import { Device, type DeviceRecord } from "#domain/device.js";
import { User, type UserRecord } from "#domain/user.js";

const USER_ID_PREFIX = "user_";
const DEVICE_ID_PREFIX = "device_";
const SESSION_ID_PREFIX = "session_";
const REGISTRATION_ID_PREFIX = "registration_";
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const REDEEM_ATTEMPT_LIMIT = 5;

const SESSION_KIND = {
  ADMINISTRATION: "administration",
  PIN: "pin",
  STATION: "station",
} as const;

type SessionKind = (typeof SESSION_KIND)[keyof typeof SESSION_KIND];

export interface Session {
  sessionId: string;
  userId: string;
  displayName: string;
  deviceId: string;
  venueId: string;
  kind: SessionKind;
}

interface PublicRegistrationCode {
  id: string;
  venueId: string;
  expiresAt: number;
  failedRedeems: number;
  locked: boolean;
  used: boolean;
}

export interface RegistrationCodeRecord {
  id: string;
  venueId: string;
  codeHash: string;
  expiresAt: number;
  failedRedeems: number;
  locked: boolean;
  used: boolean;
}

export interface IdentityRecord {
  tenantId: string;
  users: UserRecord[];
  devices: DeviceRecord[];
  registrationCodes: RegistrationCodeRecord[];
  sessions: Session[];
}

export interface IdentitySnapshot {
  tenantId: string;
  users: ReturnType<User["toPublic"]>[];
  devices: ReturnType<Device["toPublic"]>[];
  registrationCodes: PublicRegistrationCode[];
  sessions: Session[];
}

interface RegisterUser {
  id: string;
  displayName: string;
  passwordHash: string;
  pinHash: string;
}

interface EnrollSecondFactor {
  userId: string;
  factorHash: string;
}

interface SignInAdministration {
  userId: string;
  passwordHash: string;
  factorHash: string | null;
  sessionId: string;
}

interface StartPinSession {
  userId: string;
  deviceId: string;
  pinHash: string;
  sessionId: string;
}

interface IssueRegistrationCode {
  id: string;
  venueId: string;
  codeHash: string;
  now: number;
}

interface IssuedRegistrationCode {
  id: string;
  expiresAt: number;
}

interface RegisterDevice {
  registrationId: string;
  codeHash: string;
  deviceId: string;
  userId: string;
  venueId: string;
  publicKey: string;
  now: number;
}

interface RegisterFixedStation {
  id: string;
  venueId: string;
  stationId: string;
  displayName: string;
  publicKey: string;
}

interface OpenFixedStation {
  deviceId: string;
  sessionId: string;
  stationId: string;
}

interface RevokeDevice {
  deviceId: string;
}

interface AuthorizeOperation {
  deviceId: string;
  stationId: string | null;
}

interface DeactivateUser {
  userId: string;
}

export class DuplicateIdentityId extends Error {
  constructor() {
    super("That identity identifier is already in use.");
    this.name = "DuplicateIdentityId";
  }
}

export class InvalidIdentityId extends Error {
  constructor() {
    super(
      "An identity identifier must use the user_, device_, session_, or registration_ prefix.",
    );
    this.name = "InvalidIdentityId";
  }
}

export class PasswordRejected extends Error {
  constructor() {
    super("The password was rejected.");
    this.name = "PasswordRejected";
  }
}

export class PinRejected extends Error {
  constructor() {
    super("The PIN was rejected.");
    this.name = "PinRejected";
  }
}

export class PinAttemptsLocked extends Error {
  constructor() {
    super("The device rejected further PIN attempts after five failures.");
    this.name = "PinAttemptsLocked";
  }
}

export class SecondFactorRequired extends Error {
  constructor() {
    super("A second factor is required for this user.");
    this.name = "SecondFactorRequired";
  }
}

export class SecondFactorRejected extends Error {
  constructor() {
    super("The second factor code was rejected.");
    this.name = "SecondFactorRejected";
  }
}

export class RegistrationCodeRejected extends Error {
  constructor() {
    super("The registration code was rejected.");
    this.name = "RegistrationCodeRejected";
  }
}

export class RegistrationCodeLocked extends Error {
  constructor() {
    super("The registration code is locked after five failed redeems.");
    this.name = "RegistrationCodeLocked";
  }
}

export class RegistrationCodeReused extends Error {
  constructor() {
    super("The registration code was already used.");
    this.name = "RegistrationCodeReused";
  }
}

export class RegistrationCodeExpired extends Error {
  constructor() {
    super("The registration code expired.");
    this.name = "RegistrationCodeExpired";
  }
}

export class DeviceRevoked extends Error {
  constructor() {
    super("The device is revoked.");
    this.name = "DeviceRevoked";
  }
}

export class StationRefused extends Error {
  constructor() {
    super("The fixed station device cannot open that station.");
    this.name = "StationRefused";
  }
}

export class UnknownIdentityReference extends Error {
  constructor() {
    super("The identity does not include that reference.");
    this.name = "UnknownIdentityReference";
  }
}

export class UserDeactivated extends Error {
  constructor() {
    super("The user is deactivated.");
    this.name = "UserDeactivated";
  }
}

function assertPrefixed(id: string, prefix: string): void {
  if (!id.startsWith(prefix) || id.length === prefix.length) {
    throw new InvalidIdentityId();
  }
}

export class Identity {
  readonly tenantId: string;
  private readonly takenIds = new Set<string>();
  private readonly userList: User[] = [];
  private readonly deviceList: Device[] = [];
  private readonly codeList: RegistrationCodeRecord[] = [];
  private sessionList: Session[] = [];

  private constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static open(tenantId: string): Identity {
    return new Identity(tenantId);
  }

  static restore(record: IdentityRecord): Identity {
    const identity = new Identity(record.tenantId);

    for (const user of record.users) {
      identity.takenIds.add(user.id);
      identity.userList.push(User.restore(user));
    }

    for (const device of record.devices) {
      identity.takenIds.add(device.id);
      identity.deviceList.push(Device.restore(device));
    }

    for (const code of record.registrationCodes) {
      identity.takenIds.add(code.id);
      identity.codeList.push({ ...code });
    }

    identity.sessionList = record.sessions.map((session) => ({ ...session }));

    return identity;
  }

  registerUser(input: RegisterUser): void {
    assertPrefixed(input.id, USER_ID_PREFIX);
    this.reserve(input.id);
    this.userList.push(User.register(input));
  }

  enrollSecondFactor(input: EnrollSecondFactor): void {
    assertPrefixed(input.userId, USER_ID_PREFIX);
    this.userById(input.userId).enrollSecondFactor(input.factorHash);
  }

  signInAdministration(input: SignInAdministration): Session {
    assertPrefixed(input.userId, USER_ID_PREFIX);
    assertPrefixed(input.sessionId, SESSION_ID_PREFIX);
    const user = this.userById(input.userId);
    this.assertActive(user);
    this.assertPassword(user, input.passwordHash);
    this.assertSecondFactor(user, input.factorHash);

    return this.addSession({
      sessionId: input.sessionId,
      userId: user.id,
      displayName: user.displayName,
      deviceId: "",
      venueId: "",
      kind: SESSION_KIND.ADMINISTRATION,
    });
  }

  startPinSession(input: StartPinSession): Session {
    assertPrefixed(input.userId, USER_ID_PREFIX);
    assertPrefixed(input.deviceId, DEVICE_ID_PREFIX);
    assertPrefixed(input.sessionId, SESSION_ID_PREFIX);
    const user = this.userById(input.userId);
    this.assertActive(user);
    const device = this.deviceById(input.deviceId);
    this.assertOperable(device);
    this.assertPersonalDevice(device);
    this.assertPin(user, device, input.pinHash);
    device.resetPinAttempts();

    return this.replaceDeviceSession({
      sessionId: input.sessionId,
      userId: user.id,
      displayName: user.displayName,
      deviceId: device.id,
      venueId: device.venueId,
      kind: SESSION_KIND.PIN,
    });
  }

  issueRegistrationCode(input: IssueRegistrationCode): IssuedRegistrationCode {
    assertPrefixed(input.id, REGISTRATION_ID_PREFIX);
    this.reserve(input.id);
    const expiresAt = input.now + FIVE_MINUTES_MS;
    this.codeList.push({
      id: input.id,
      venueId: input.venueId,
      codeHash: input.codeHash,
      expiresAt,
      failedRedeems: 0,
      locked: false,
      used: false,
    });

    return { id: input.id, expiresAt };
  }

  registerDevice(input: RegisterDevice): void {
    assertPrefixed(input.registrationId, REGISTRATION_ID_PREFIX);
    assertPrefixed(input.deviceId, DEVICE_ID_PREFIX);
    assertPrefixed(input.userId, USER_ID_PREFIX);
    const code = this.codeById(input.registrationId);
    const user = this.userById(input.userId);
    this.assertActive(user);
    this.assertCodeAccepts(code, input);

    if (code.codeHash !== input.codeHash) {
      this.recordFailedRedeem(code);
    }

    this.reserve(input.deviceId);
    code.used = true;
    this.deviceList.push(
      Device.registerPersonal({
        id: input.deviceId,
        venueId: code.venueId,
        publicKey: input.publicKey,
      }),
    );
  }

  registerFixedStation(input: RegisterFixedStation): void {
    assertPrefixed(input.id, DEVICE_ID_PREFIX);
    this.reserve(input.id);
    this.deviceList.push(Device.registerFixed(input));
  }

  openFixedStation(input: OpenFixedStation): Session {
    assertPrefixed(input.deviceId, DEVICE_ID_PREFIX);
    assertPrefixed(input.sessionId, SESSION_ID_PREFIX);
    const device = this.deviceById(input.deviceId);
    this.assertOperable(device);

    if (!device.isFixedStation || device.stationId !== input.stationId) {
      throw new StationRefused();
    }

    return this.replaceDeviceSession({
      sessionId: input.sessionId,
      userId: "",
      displayName: device.displayName,
      deviceId: device.id,
      venueId: device.venueId,
      kind: SESSION_KIND.STATION,
    });
  }

  revokeDevice(input: RevokeDevice): void {
    assertPrefixed(input.deviceId, DEVICE_ID_PREFIX);
    const device = this.deviceById(input.deviceId);

    if (device.revoked) {
      throw new DeviceRevoked();
    }

    device.revoke();
    this.sessionList = this.sessionList.filter(
      (session) => session.deviceId !== device.id,
    );
  }

  authorizeOperation(input: AuthorizeOperation): void {
    assertPrefixed(input.deviceId, DEVICE_ID_PREFIX);
    const device = this.deviceById(input.deviceId);
    this.assertOperable(device);

    if (device.stationId !== input.stationId) {
      throw new StationRefused();
    }
  }

  deactivateUser(input: DeactivateUser): void {
    assertPrefixed(input.userId, USER_ID_PREFIX);
    const user = this.userById(input.userId);
    user.deactivate();
    this.sessionList = this.sessionList.filter(
      (session) => session.userId !== user.id,
    );
  }

  toRecord(): IdentityRecord {
    return {
      tenantId: this.tenantId,
      users: this.userList.map((user) => user.toRecord()),
      devices: this.deviceList.map((device) => device.toRecord()),
      registrationCodes: this.codeList.map((code) => ({ ...code })),
      sessions: this.sessionList.map((session) => ({ ...session })),
    };
  }

  snapshot(): IdentitySnapshot {
    return {
      tenantId: this.tenantId,
      users: this.userList.map((user) => user.toPublic()),
      devices: this.deviceList.map((device) => device.toPublic()),
      registrationCodes: this.codeList.map((code) => ({
        id: code.id,
        venueId: code.venueId,
        expiresAt: code.expiresAt,
        failedRedeems: code.failedRedeems,
        locked: code.locked,
        used: code.used,
      })),
      sessions: this.sessionList.map((session) => ({ ...session })),
    };
  }

  private reserve(id: string): void {
    if (this.takenIds.has(id)) {
      throw new DuplicateIdentityId();
    }

    this.takenIds.add(id);
  }

  private userById(id: string): User {
    const user = this.userList.find((item) => item.id === id);

    if (!user) {
      throw new UnknownIdentityReference();
    }

    return user;
  }

  private deviceById(id: string): Device {
    const device = this.deviceList.find((item) => item.id === id);

    if (!device) {
      throw new UnknownIdentityReference();
    }

    return device;
  }

  private codeById(id: string): RegistrationCodeRecord {
    const code = this.codeList.find((item) => item.id === id);

    if (!code) {
      throw new UnknownIdentityReference();
    }

    return code;
  }

  private assertActive(user: User): void {
    if (!user.active) {
      throw new UserDeactivated();
    }
  }

  private assertPassword(user: User, passwordHash: string): void {
    if (!user.matchesPassword(passwordHash)) {
      throw new PasswordRejected();
    }
  }

  private assertSecondFactor(user: User, factorHash: string | null): void {
    if (!user.secondFactorEnrolled) {
      return;
    }

    if (factorHash === null) {
      throw new SecondFactorRequired();
    }

    if (!user.matchesFactor(factorHash)) {
      user.recordFailedFactor();
      throw new SecondFactorRejected();
    }
  }

  private assertOperable(device: Device): void {
    if (device.revoked) {
      throw new DeviceRevoked();
    }
  }

  private assertPersonalDevice(device: Device): void {
    if (!device.isPersonal) {
      throw new StationRefused();
    }
  }

  private assertPin(user: User, device: Device, pinHash: string): void {
    if (device.pinAttemptsLocked) {
      throw new PinAttemptsLocked();
    }

    if (user.matchesPin(pinHash)) {
      return;
    }

    device.recordFailedPin();

    if (device.pinAttemptsLocked) {
      throw new PinAttemptsLocked();
    }

    throw new PinRejected();
  }

  private assertCodeAccepts(
    code: RegistrationCodeRecord,
    input: RegisterDevice,
  ): void {
    if (code.used) {
      throw new RegistrationCodeReused();
    }

    if (code.locked) {
      throw new RegistrationCodeLocked();
    }

    if (input.now >= code.expiresAt) {
      throw new RegistrationCodeExpired();
    }

    if (code.venueId !== input.venueId) {
      throw new UnknownIdentityReference();
    }
  }

  private recordFailedRedeem(code: RegistrationCodeRecord): never {
    code.failedRedeems += 1;

    if (code.failedRedeems >= REDEEM_ATTEMPT_LIMIT) {
      code.locked = true;
      throw new RegistrationCodeLocked();
    }

    throw new RegistrationCodeRejected();
  }

  private addSession(session: Session): Session {
    this.sessionList.push(session);

    return { ...session };
  }

  private replaceDeviceSession(session: Session): Session {
    this.sessionList = this.sessionList.filter(
      (current) => current.deviceId !== session.deviceId,
    );
    this.sessionList.push(session);

    return { ...session };
  }
}
