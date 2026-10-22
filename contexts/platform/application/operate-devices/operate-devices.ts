import { SiteOffline } from "#application/operate-identity/operate-identity.js";
import type { Clock } from "#application/ports/clock.js";
import type {
  IdentityChanged,
  IdentityRepository,
} from "#application/ports/identity-repository.js";
import type { PasswordHasher } from "#application/ports/password-hasher.js";
import type { SignatureVerifier } from "#application/ports/signature-verifier.js";
import {
  type Identity,
  UnknownIdentityReference,
} from "#domain/identity.js";

const DEVICE_COMMAND = {
  ISSUE_REGISTRATION_CODE: "issueRegistrationCode",
  REGISTER_DEVICE: "registerDevice",
  REVOKE_DEVICE: "revokeDevice",
  OPEN_FIXED_STATION: "openFixedStation",
  AUTHORIZE_OPERATION: "authorizeOperation",
} as const;

interface IssueRegistrationCodeCommand {
  type: typeof DEVICE_COMMAND.ISSUE_REGISTRATION_CODE;
  id: string;
  venueId: string;
  code: string;
}

interface RegisterDeviceCommand {
  type: typeof DEVICE_COMMAND.REGISTER_DEVICE;
  registrationId: string;
  code: string;
  deviceId: string;
  userId: string;
  venueId: string;
  publicKey: string;
  signature: string | null;
}

interface RevokeDeviceCommand {
  type: typeof DEVICE_COMMAND.REVOKE_DEVICE;
  deviceId: string;
  signature: string | null;
}

interface OpenFixedStationCommand {
  type: typeof DEVICE_COMMAND.OPEN_FIXED_STATION;
  deviceId: string;
  sessionId: string;
  stationId: string;
  signature: string | null;
}

interface AuthorizeOperationCommand {
  type: typeof DEVICE_COMMAND.AUTHORIZE_OPERATION;
  deviceId: string;
  stationId: string | null;
  signature: string | null;
}

export type DeviceCommand =
  | IssueRegistrationCodeCommand
  | RegisterDeviceCommand
  | RevokeDeviceCommand
  | OpenFixedStationCommand
  | AuthorizeOperationCommand;

export interface OperateDevicesInput {
  tenantId: string;
  siteOffline: boolean;
  command: DeviceCommand;
}

export interface OperateDevicesResult {
  event: IdentityChanged;
  registrationCode?: string;
}

interface SignedCommand {
  signature: string | null;
}

const assertNever = (command: never): never => {
  throw command;
};

const signedPayload = (command: object): string => {
  const entries = Object.entries(command)
    .filter(([key]) => key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(Object.fromEntries(entries));
};

export class UnsignedSignature extends Error {
  constructor() {
    super("The device request was not signed.");
    this.name = "UnsignedSignature";
  }
}

export class BadSignature extends Error {
  constructor() {
    super("The device signature was rejected.");
    this.name = "BadSignature";
  }
}

export class OperateDevices {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly signatures: SignatureVerifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: OperateDevicesInput): Promise<OperateDevicesResult> {
    if (input.siteOffline) {
      throw new SiteOffline();
    }

    const identity = await this.identities.load(input.tenantId);

    if (identity === null) {
      throw new UnknownIdentityReference();
    }

    const before = identity.snapshot();

    try {
      const registrationCode = await this.apply(identity, input.command);
      const event: IdentityChanged = {
        before,
        after: identity.snapshot(),
      };

      await this.identities.save(identity, event);

      if (registrationCode === undefined) {
        return { event };
      }

      return { event, registrationCode };
    } catch (error) {
      await this.recordAttempt(identity, before);
      throw error;
    }
  }

  private async recordAttempt(
    identity: Identity,
    before: IdentityChanged["before"],
  ): Promise<void> {
    const after = identity.snapshot();

    if (JSON.stringify(before) === JSON.stringify(after)) {
      return;
    }

    await this.identities.save(identity, { before, after });
  }

  private async apply(
    identity: Identity,
    command: DeviceCommand,
  ): Promise<string | undefined> {
    switch (command.type) {
      case DEVICE_COMMAND.ISSUE_REGISTRATION_CODE:
        return this.issueRegistrationCode(identity, command);
      case DEVICE_COMMAND.REGISTER_DEVICE:
        await this.registerDevice(identity, command);
        return undefined;
      case DEVICE_COMMAND.REVOKE_DEVICE:
        await this.revokeDevice(identity, command);
        return undefined;
      case DEVICE_COMMAND.OPEN_FIXED_STATION:
        await this.openFixedStation(identity, command);
        return undefined;
      case DEVICE_COMMAND.AUTHORIZE_OPERATION:
        await this.authorizeOperation(identity, command);
        return undefined;
      default:
        return assertNever(command);
    }
  }

  private async issueRegistrationCode(
    identity: Identity,
    command: IssueRegistrationCodeCommand,
  ): Promise<string> {
    identity.issueRegistrationCode({
      id: command.id,
      venueId: command.venueId,
      codeHash: await this.passwords.hash(command.code),
      now: this.clock.now(),
    });

    return command.code;
  }

  private async registerDevice(
    identity: Identity,
    command: RegisterDeviceCommand,
  ): Promise<void> {
    await this.assertSignature(command, command.publicKey);
    identity.registerDevice({
      registrationId: command.registrationId,
      codeHash: await this.passwords.hash(command.code),
      deviceId: command.deviceId,
      userId: command.userId,
      venueId: command.venueId,
      publicKey: command.publicKey,
      now: this.clock.now(),
    });
  }

  private async revokeDevice(
    identity: Identity,
    command: RevokeDeviceCommand,
  ): Promise<void> {
    await this.assertStoredSignature(identity, command, command.deviceId);
    identity.revokeDevice({ deviceId: command.deviceId });
  }

  private async openFixedStation(
    identity: Identity,
    command: OpenFixedStationCommand,
  ): Promise<void> {
    await this.assertStoredSignature(identity, command, command.deviceId);
    identity.openFixedStation({
      deviceId: command.deviceId,
      sessionId: command.sessionId,
      stationId: command.stationId,
    });
  }

  private async authorizeOperation(
    identity: Identity,
    command: AuthorizeOperationCommand,
  ): Promise<void> {
    await this.assertStoredSignature(identity, command, command.deviceId);
    identity.authorizeOperation({
      deviceId: command.deviceId,
      stationId: command.stationId,
    });
  }

  private async assertStoredSignature(
    identity: Identity,
    command: SignedCommand,
    deviceId: string,
  ): Promise<void> {
    const device = identity
      .snapshot()
      .devices.find((item) => item.id === deviceId);

    if (device === undefined) {
      throw new UnknownIdentityReference();
    }

    await this.assertSignature(command, device.publicKey);
  }

  private async assertSignature(
    command: SignedCommand,
    publicKey: string,
  ): Promise<void> {
    if (command.signature === null || command.signature.length === 0) {
      throw new UnsignedSignature();
    }

    const accepted = await this.signatures.verify({
      publicKey,
      payload: signedPayload(command),
      signature: command.signature,
    });

    if (!accepted) {
      throw new BadSignature();
    }
  }
}
