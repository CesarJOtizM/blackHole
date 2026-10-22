import { Clock } from "#application/ports/clock.js";
import { PasswordHasher } from "#application/ports/password-hasher.js";
import { PinHasher } from "#application/ports/pin-hasher.js";
import { SecondFactor } from "#application/ports/second-factor.js";

export const signFast = (publicKey: string, payload: string): string =>
  `signature:${publicKey}:${payload}`;

export class FastPasswordHasher extends PasswordHasher {
  override async hash(password: string): Promise<string> {
    return `password-hash:${password}`;
  }
}

export class FastPinHasher extends PinHasher {
  override async hash(pin: string): Promise<string> {
    return `pin-hash:${pin}`;
  }
}

export class FastSecondFactor extends SecondFactor {
  override async enroll(code: string): Promise<string> {
    return `factor-hash:${code}`;
  }

  override async verify(code: string): Promise<string> {
    return `factor-hash:${code}`;
  }
}

export class FakeClock extends Clock {
  private current: number;

  constructor(start: number) {
    super();
    this.current = start;
  }

  override now(): number {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}
