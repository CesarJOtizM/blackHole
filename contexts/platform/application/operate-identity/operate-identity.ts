import type { Clock } from "#application/ports/clock.js";
import type {
  IdentityChanged,
  IdentityRepository,
} from "#application/ports/identity-repository.js";
import type { PasswordHasher } from "#application/ports/password-hasher.js";
import type { PinHasher } from "#application/ports/pin-hasher.js";
import type { SecondFactor } from "#application/ports/second-factor.js";
import { type Identity, UnknownIdentityReference } from "#domain/identity.js";

const IDENTITY_COMMAND = {
  SIGN_IN_ADMINISTRATION: "signInAdministration",
  ENROLL_SECOND_FACTOR: "enrollSecondFactor",
  REQUIRE_SECOND_FACTOR: "requireSecondFactor",
  START_PIN_SESSION: "startPinSession",
  RECORD_ACTIVITY: "recordActivity",
  DEACTIVATE_USER: "deactivateUser",
} as const;

interface SignInAdministrationCommand {
  type: typeof IDENTITY_COMMAND.SIGN_IN_ADMINISTRATION;
  userId: string;
  password: string;
  factorCode: string | null;
  sessionId: string;
}

interface EnrollSecondFactorCommand {
  type: typeof IDENTITY_COMMAND.ENROLL_SECOND_FACTOR;
  userId: string;
  code: string;
}

interface RequireSecondFactorCommand {
  type: typeof IDENTITY_COMMAND.REQUIRE_SECOND_FACTOR;
  userId: string;
  code: string;
}

interface StartPinSessionCommand {
  type: typeof IDENTITY_COMMAND.START_PIN_SESSION;
  userId: string;
  deviceId: string;
  pin: string;
  sessionId: string;
  idleLockMs: number;
}

interface RecordActivityCommand {
  type: typeof IDENTITY_COMMAND.RECORD_ACTIVITY;
  sessionId: string;
}

interface DeactivateUserCommand {
  type: typeof IDENTITY_COMMAND.DEACTIVATE_USER;
  userId: string;
}

export type IdentityCommand =
  | SignInAdministrationCommand
  | EnrollSecondFactorCommand
  | RequireSecondFactorCommand
  | StartPinSessionCommand
  | RecordActivityCommand
  | DeactivateUserCommand;

export interface OperateIdentityInput {
  tenantId: string;
  siteOffline: boolean;
  command: IdentityCommand;
}

interface ActivityStamp {
  at: number;
  idleLockMs: number;
}

const assertNever = (command: never): never => {
  throw command;
};

export class SiteOffline extends Error {
  constructor() {
    super("No session starts while the site is offline.");
    this.name = "SiteOffline";
  }
}

export class SessionIdle extends Error {
  constructor() {
    super("The PIN is required again.");
    this.name = "SessionIdle";
  }
}

export class OperateIdentity {
  private readonly activity = new Map<string, ActivityStamp>();

  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly pins: PinHasher,
    private readonly secondFactor: SecondFactor,
    private readonly clock: Clock,
  ) {}

  async execute(input: OperateIdentityInput): Promise<IdentityChanged> {
    if (this.refusesOffline(input)) {
      throw new SiteOffline();
    }

    const identity = await this.identities.load(input.tenantId);

    if (identity === null) {
      throw new UnknownIdentityReference();
    }

    const before = identity.snapshot();

    try {
      await this.apply(identity, input);
    } catch (error) {
      await this.recordAttempt(identity, before);
      throw error;
    }

    const event: IdentityChanged = {
      before,
      after: identity.snapshot(),
    };

    await this.identities.save(identity, event);

    return event;
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

  private refusesOffline(input: OperateIdentityInput): boolean {
    if (!input.siteOffline) {
      return false;
    }

    return (
      input.command.type === IDENTITY_COMMAND.START_PIN_SESSION ||
      input.command.type === IDENTITY_COMMAND.RECORD_ACTIVITY
    );
  }

  private async apply(
    identity: Identity,
    input: OperateIdentityInput,
  ): Promise<void> {
    const { command } = input;

    switch (command.type) {
      case IDENTITY_COMMAND.SIGN_IN_ADMINISTRATION:
        await this.signIn(identity, command);
        return;
      case IDENTITY_COMMAND.ENROLL_SECOND_FACTOR:
      case IDENTITY_COMMAND.REQUIRE_SECOND_FACTOR:
        await this.enrollFactor(identity, command);
        return;
      case IDENTITY_COMMAND.START_PIN_SESSION:
        await this.startPin(identity, input.tenantId, command);
        return;
      case IDENTITY_COMMAND.RECORD_ACTIVITY:
        this.recordActivity(identity, input.tenantId, command);
        return;
      case IDENTITY_COMMAND.DEACTIVATE_USER:
        this.deactivate(identity, input.tenantId, command);
        return;
      default:
        assertNever(command);
    }
  }

  private async signIn(
    identity: Identity,
    command: SignInAdministrationCommand,
  ): Promise<void> {
    const passwordHash = await this.passwords.hash(command.password);
    const factorHash =
      command.factorCode === null
        ? null
        : await this.secondFactor.verify(command.factorCode);

    identity.signInAdministration({
      userId: command.userId,
      passwordHash,
      factorHash,
      sessionId: command.sessionId,
    });
  }

  private async enrollFactor(
    identity: Identity,
    command: EnrollSecondFactorCommand | RequireSecondFactorCommand,
  ): Promise<void> {
    identity.enrollSecondFactor({
      userId: command.userId,
      factorHash: await this.secondFactor.enroll(command.code),
    });
  }

  private async startPin(
    identity: Identity,
    tenantId: string,
    command: StartPinSessionCommand,
  ): Promise<void> {
    const session = identity.startPinSession({
      userId: command.userId,
      deviceId: command.deviceId,
      pinHash: await this.pins.hash(command.pin),
      sessionId: command.sessionId,
    });

    this.activity.set(this.activityKey(tenantId, session.sessionId), {
      at: this.clock.now(),
      idleLockMs: command.idleLockMs,
    });
  }

  private recordActivity(
    identity: Identity,
    tenantId: string,
    command: RecordActivityCommand,
  ): void {
    const session = identity
      .snapshot()
      .sessions.find((item) => item.sessionId === command.sessionId);

    if (session === undefined || session.kind !== "pin") {
      throw new UnknownIdentityReference();
    }

    const tracked = this.activity.get(
      this.activityKey(tenantId, command.sessionId),
    );

    if (tracked === undefined) {
      throw new SessionIdle();
    }

    const now = this.clock.now();

    if (now - tracked.at >= tracked.idleLockMs) {
      throw new SessionIdle();
    }

    tracked.at = now;
  }

  private deactivate(
    identity: Identity,
    tenantId: string,
    command: DeactivateUserCommand,
  ): void {
    const ended = identity
      .snapshot()
      .sessions.filter((session) => session.userId === command.userId);

    identity.deactivateUser({ userId: command.userId });

    for (const session of ended) {
      this.activity.delete(this.activityKey(tenantId, session.sessionId));
    }
  }

  private activityKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
  }
}
