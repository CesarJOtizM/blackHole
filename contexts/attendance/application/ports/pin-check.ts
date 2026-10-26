export interface ClockPin {
  tenantId: string;
  userId: string;
  pin: string;
  deviceId: string;
  sessionId: string;
}

export abstract class PinCheck {
  abstract confirm(input: ClockPin): Promise<void>;
}

export class PinCheckRejected extends Error {
  constructor() {
    super("The PIN was rejected.");
    this.name = "PinCheckRejected";
  }
}

/** Shape of `@blackhole/platform` PinVerifier.confirm. Passed in, not imported. */
export interface PlatformPinConfirmation {
  tenantId: string;
  userId: string;
  pin: string;
  sessionId: string;
}

export interface PlatformPinVerifier {
  confirm(input: PlatformPinConfirmation): Promise<void>;
}

export class PlatformPinCheck extends PinCheck {
  constructor(private readonly verifier: PlatformPinVerifier) {
    super();
  }

  override async confirm(input: ClockPin): Promise<void> {
    await this.verifier.confirm({
      tenantId: input.tenantId,
      userId: input.userId,
      pin: input.pin,
      sessionId: input.sessionId,
    });
  }
}
