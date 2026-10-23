import { AuthorizationClock } from "#application/ports/authorization-clock.js";
import type { IdentityView } from "#application/ports/identity-reader.js";
import { IdentityReader } from "#application/ports/identity-reader.js";
import type { PinConfirmation } from "#application/ports/pin-verifier.js";
import {
  PinConfirmationLocked,
  PinConfirmationRejected,
  PinVerifier,
} from "#application/ports/pin-verifier.js";
import type { SessionView } from "#application/ports/session-reader.js";
import { SessionReader } from "#application/ports/session-reader.js";

const FAILURE_LIMIT = 5;

export class InMemorySessionReader extends SessionReader {
  private readonly sessions = new Map<string, SessionView>();

  put(tenantId: string, session: SessionView): void {
    this.sessions.set(this.key(tenantId, session.sessionId), { ...session });
  }

  override async find(
    tenantId: string,
    sessionId: string,
  ): Promise<SessionView | null> {
    const session = this.sessions.get(this.key(tenantId, sessionId));

    return session ? { ...session } : null;
  }

  private key(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
  }
}

export class InMemoryIdentityReader extends IdentityReader {
  private readonly people = new Map<string, IdentityView>();

  put(tenantId: string, person: IdentityView): void {
    this.people.set(this.key(tenantId, person.userId), { ...person });
  }

  override async find(
    tenantId: string,
    userId: string,
  ): Promise<IdentityView | null> {
    const person = this.people.get(this.key(tenantId, userId));

    return person ? { ...person } : null;
  }

  private key(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }
}

export class MemoryPinVerifier extends PinVerifier {
  private readonly failures = new Map<string, number>();
  private readonly locked = new Set<string>();

  constructor(private readonly pins: ReadonlyMap<string, string>) {
    super();
  }

  override async confirm(input: PinConfirmation): Promise<void> {
    if (this.locked.has(input.userId)) {
      throw new PinConfirmationLocked();
    }

    if (this.pins.get(input.userId) !== input.pin) {
      const count = (this.failures.get(input.userId) ?? 0) + 1;
      this.failures.set(input.userId, count);

      if (count >= FAILURE_LIMIT) {
        this.locked.add(input.userId);
        throw new PinConfirmationLocked();
      }

      throw new PinConfirmationRejected();
    }

    this.failures.set(input.userId, 0);
  }

  isLocked(userId: string): boolean {
    return this.locked.has(userId);
  }
}

export class FakeAuthorizationClock extends AuthorizationClock {
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
