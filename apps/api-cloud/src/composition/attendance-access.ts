import { Clock as AttendanceClock } from "@blackhole/attendance/application/ports/clock";
import {
  ATTENDANCE_CORRECT,
  AttendanceSiteAccess,
} from "@blackhole/attendance/application/read-attendance";
import {
  EvaluatePermission,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import type { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import type { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import type { Clock } from "@blackhole/platform/application/ports/clock";
import type { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import type { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import type { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import type {
  SessionReader,
  SessionView,
} from "@blackhole/platform/application/ports/session-reader";

export class ClockRejected extends Error {
  constructor() {
    super("The clock request was rejected.");
    this.name = "ClockRejected";
  }
}

export class AttendanceCorrectDenied extends Error {
  constructor() {
    super("Attendance correction is denied.");
    this.name = "AttendanceCorrectDenied";
  }
}

export class PlatformAttendanceClock extends AttendanceClock {
  constructor(private readonly clock: Clock) {
    super();
  }

  override now(): number {
    return this.clock.now();
  }
}

export const assertPinDevice = async (
  identities: IdentityRepository,
  tenantId: string,
  venueId: string,
  session: SessionView,
): Promise<void> => {
  if (session.kind !== "pin" || session.venueId !== venueId) {
    throw new ClockRejected();
  }

  const identity = await identities.load(tenantId);
  const device = identity
    ?.snapshot()
    .devices.find((item) => item.id === session.deviceId);

  if (!device || device.revoked || device.venueId !== venueId) {
    throw new ClockRejected();
  }
};

export const cashRegisterIdFor = async (
  authorizations: AuthorizationRepository,
  organizations: OrganizationRepository,
  tenantId: string,
  userId: string,
  venueId: string,
): Promise<string | undefined> => {
  const authorization = await authorizations.load(tenantId);
  const cashier = authorization
    ?.snapshot()
    .assignments.some(
      (assignment) =>
        assignment.userId === userId &&
        assignment.roleId === "cashier" &&
        assignment.scopeKind === "site" &&
        assignment.scopeId === venueId,
    );

  if (!cashier) {
    return undefined;
  }

  const organization = await organizations.load(tenantId);

  return organization?.cashRegisters.find((item) => item.venueId === venueId)
    ?.id;
};

const brandOf = async (
  organizations: OrganizationRepository,
  tenantId: string,
  venueId: string,
): Promise<string | null> => {
  const organization = await organizations.load(tenantId);

  return (
    organization?.venues.find((venue) => venue.id === venueId)?.brandId ?? null
  );
};

export class SessionAttendanceAccess extends AttendanceSiteAccess {
  constructor(
    private readonly sessionId: string,
    private readonly sessions: SessionReader,
    private readonly organizations: OrganizationRepository,
    private readonly evaluate: EvaluatePermission,
  ) {
    super();
  }

  override async allow(input: {
    tenantId: string;
    actorId: string;
    venueId: string;
    permission: typeof ATTENDANCE_CORRECT;
  }): Promise<boolean> {
    const session = await this.sessions.find(input.tenantId, this.sessionId);

    if (!session || session.userId !== input.actorId) {
      return false;
    }

    const brandId = await brandOf(
      this.organizations,
      input.tenantId,
      input.venueId,
    );

    if (brandId === null) {
      return false;
    }

    try {
      const decision = await this.evaluate.execute({
        tenantId: input.tenantId,
        sessionId: this.sessionId,
        permission: ATTENDANCE_CORRECT,
        target: { kind: "site", id: input.venueId, brandId },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      return decision.outcome === "allowed";
    } catch (error: unknown) {
      if (
        error instanceof UnknownSession ||
        error instanceof UnknownAuthorization
      ) {
        return false;
      }

      throw error;
    }
  }
}

export const permissionEvaluator = (
  authorizations: AuthorizationRepository,
  sessions: SessionReader,
  identities: IdentityReader,
  clock: AuthorizationClock,
): EvaluatePermission =>
  new EvaluatePermission(authorizations, sessions, identities, clock);
