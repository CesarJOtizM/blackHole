import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import type { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import type { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import type {
  PrintJobRequest,
  QueuedPrintJob,
} from "@blackhole/orders/application/ports/printer";
import { Check, DiningTable } from "@blackhole/orders/domain";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";

export const tenantId = "organization_company_1";
export const venueId = "organization_venue_1";
export const ownerId = "user_owner";
export const kitchenChiefId = "user_kitchen";
export const tableId = "table_5";
export const checkId = "check_5";
export const sessionHeader = "x-session-id";
export const openedAt = "2026-10-28T12:00:00.000Z";

export class WatchingOrdersPrinter extends InMemoryPrinter {
  readonly queued: QueuedPrintJob[] = [];

  override async enqueue(job: PrintJobRequest): Promise<QueuedPrintJob> {
    const queued = await super.enqueue(job);

    this.queued.push(queued);

    return queued;
  }
}

const people = [
  [ownerId, "session_owner", "owner"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
] as const;

export const openDiningCloud = async (deps?: {
  organizations?: InMemoryOrganizationRepository;
  menus?: InMemoryMenuRepository;
  stationRoutes?: InMemoryStationRouteRepository;
  printer?: InMemoryPrinter;
}): Promise<{
  application: NestFastifyApplication;
  diningRooms: InMemoryDiningRoomRepository;
  audits: InMemoryAuditRepository;
}> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const diningRooms = new InMemoryDiningRoomRepository();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: people.map(([userId, , roleId]) => ({
      id: `assignment_${roleId}`,
      userId,
      roleId,
      scopeKind: "company" as const,
      scopeId: tenantId,
      validFrom: null,
      validUntil: null,
    })),
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });
  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: deps?.organizations ?? new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(Date.parse(openedAt)),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(
      identities,
      new FakeClock(Date.parse(openedAt)),
    ),
    authorizations,
    audits,
    diningRooms,
    ...(deps?.menus === undefined ? {} : { menus: deps.menus }),
    ...(deps?.stationRoutes === undefined
      ? {}
      : { stationRoutes: deps.stationRoutes }),
    ...(deps?.printer === undefined ? {} : { printer: deps.printer }),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, diningRooms, audits };
};

export const placeFreeTable = async (
  diningRooms: InMemoryDiningRoomRepository,
) => {
  const table = DiningTable.place({
    id: tableId,
    tenantId,
    venueId,
    zone: "Terrace",
  });

  await diningRooms.save(table);

  return table;
};

export const occupyTable = async (
  diningRooms: InMemoryDiningRoomRepository,
) => {
  const table = await placeFreeTable(diningRooms);

  table.open({ diners: 4 });
  await diningRooms.save(table);

  return table;
};

export const markTableToClean = async (
  diningRooms: InMemoryDiningRoomRepository,
) => {
  const table = await occupyTable(diningRooms);

  table.release();
  await diningRooms.save(table);

  return table;
};

export const seatOccupiedCheck = async (
  diningRooms: InMemoryDiningRoomRepository,
) => {
  await occupyTable(diningRooms);

  const check = Check.open({
    id: checkId,
    tenantId,
    venueId,
    tableId,
    openedAt,
  });

  await diningRooms.saveCheck(check);

  return check;
};

export const diningPath = (suffix: string): string =>
  `/tenants/${tenantId}/venues/${venueId}/${suffix}`;

export const postDining = (
  application: Awaited<ReturnType<typeof createApplication>>,
  url: string,
  sessionId: string,
  payload: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "POST",
    url,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

export const getDining = (
  application: Awaited<ReturnType<typeof createApplication>>,
  url: string,
  sessionId: string,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "GET",
    url,
    headers: { [sessionHeader]: sessionId },
  });
