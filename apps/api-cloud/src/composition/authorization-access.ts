import { MemoryPinVerifier } from "@blackhole/platform/adapters/memory/authorization-doubles";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import type { Clock } from "@blackhole/platform/application/ports/clock";
import type { IdentityView } from "@blackhole/platform/application/ports/identity-reader";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import type { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import type { SessionView } from "@blackhole/platform/application/ports/session-reader";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";

export class RepositorySessionReader extends SessionReader {
  constructor(private readonly identities: IdentityRepository) {
    super();
  }

  override async find(
    tenantId: string,
    sessionId: string,
  ): Promise<SessionView | null> {
    const identity = await this.identities.load(tenantId);
    const session = identity
      ?.snapshot()
      .sessions.find((item) => item.sessionId === sessionId);

    if (!session) {
      return null;
    }

    if (session.kind !== "administration" && session.kind !== "pin") {
      return null;
    }

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      displayName: session.displayName,
      deviceId: session.deviceId,
      venueId:
        session.kind === "administration" && session.venueId === ""
          ? null
          : session.venueId,
      kind: session.kind,
    };
  }
}

export class RepositoryIdentityReader extends IdentityReader {
  constructor(private readonly identities: IdentityRepository) {
    super();
  }

  override async find(
    tenantId: string,
    userId: string,
  ): Promise<IdentityView | null> {
    const identity = await this.identities.load(tenantId);
    const user = identity?.snapshot().users.find((item) => item.id === userId);

    if (!user) {
      return null;
    }

    return { userId: user.id, active: user.active };
  }
}

export class ClockAuthorizationClock extends AuthorizationClock {
  constructor(private readonly clock: Clock) {
    super();
  }

  override now(): number {
    return this.clock.now();
  }
}

export const authorizationDependencies = (
  identities: IdentityRepository,
  clock: Clock,
) => ({
  authorizations: new InMemoryAuthorizationRepository(),
  sessions: new RepositorySessionReader(identities),
  identityViews: new RepositoryIdentityReader(identities),
  pinConfirmations: new MemoryPinVerifier(new Map()),
  authorizationClock: new ClockAuthorizationClock(clock),
});
