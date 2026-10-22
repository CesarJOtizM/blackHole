import { expect, it } from "vitest";
import type {
  AuthorizationChanged,
  AuthorizationRepository,
} from "#application/ports/authorization-repository.js";
import { Authorization } from "#domain/authorization.js";
import { LIMIT, PERMISSION } from "#domain/permission-catalog.js";

export type AuthorizationRepositorySubject = AuthorizationRepository & {
  eventsFor(tenantId: string): Promise<readonly AuthorizationChanged[]>;
};

const storedAuthorization = (suffix: string): Authorization => {
  const tenantId = `organization_company_${suffix}`;
  const ownerId = `user_owner_${suffix}`;
  const authorization = Authorization.open(tenantId);

  authorization.appointOwner({
    assignmentId: `assignment_owner_${suffix}`,
    userId: ownerId,
  });
  authorization.copyRole({
    roleId: `role_copy_${suffix}`,
    sourceRoleId: "cashier",
    actorUserId: ownerId,
    at: 10,
  });
  authorization.setVenueLimit({
    venueId: `organization_venue_${suffix}`,
    roleId: "shiftSupervisor",
    limit: LIMIT.DISCOUNT_PERCENT,
    cap: 10,
    actorUserId: ownerId,
    at: 10,
  });
  authorization.setBartenderCharge({
    venueId: `organization_venue_${suffix}`,
    enabled: true,
    actorUserId: ownerId,
    at: 10,
  });
  authorization.enableShiftSelfAuthorization({
    id: `shift_${suffix}`,
    venueId: `organization_venue_${suffix}`,
    shiftId: `shift_day_${suffix}`,
    enabled: true,
    actorUserId: ownerId,
    at: 10,
  });
  authorization.requestAuthorization({
    requestId: `request_${suffix}`,
    requesterId: `user_cashier_${suffix}`,
    permission: PERMISSION.SALE_DISCOUNT,
    venueId: `organization_venue_${suffix}`,
    value: 12,
    reason: "guest",
    expiresAt: 99,
  });
  authorization.grantSupport({
    grantId: `grant_${suffix}`,
    actorId: `support_${suffix}`,
    expiresAt: 50,
    actorUserId: ownerId,
    at: 10,
  });

  return authorization;
};

const changed = (authorization: Authorization): AuthorizationChanged => ({
  before: Authorization.open(authorization.tenantId).snapshot(),
  after: authorization.snapshot(),
});

const containsPin = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => containsPin(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(
      ([key, item]) => key.toLowerCase() === "pin" || containsPin(item),
    );
  }

  return false;
};

export function authorizationRepositoryContract(
  createRepository: () =>
    | AuthorizationRepositorySubject
    | Promise<AuthorizationRepositorySubject>,
): void {
  it("given an authorization and its change, when they are saved, then both can be read back", async () => {
    const repository = await createRepository();
    const authorization = storedAuthorization("saved");
    const event = changed(authorization);
    const expected = authorization.snapshot();

    await repository.save(authorization, event);

    const stored = await repository.load(authorization.tenantId);
    expect(stored).toBeInstanceOf(Authorization);
    if (!(stored instanceof Authorization)) {
      return;
    }
    expect(stored.snapshot()).toEqual(expected);
    expect(await repository.eventsFor(authorization.tenantId)).toEqual([event]);
  });

  it("given companies A and B, when tenant A loads authorization, then B stays hidden", async () => {
    const repository = await createRepository();
    const companyA = storedAuthorization("a");
    const companyB = storedAuthorization("b");

    await repository.save(companyA, changed(companyA));
    await repository.save(companyB, changed(companyB));

    const loadedA = await repository.load(companyA.tenantId);
    const loadedB = await repository.load(companyB.tenantId);
    expect(loadedA).toBeInstanceOf(Authorization);
    expect(loadedB).toBeInstanceOf(Authorization);
    if (!(loadedA instanceof Authorization)) {
      return;
    }
    if (!(loadedB instanceof Authorization)) {
      return;
    }
    expect(loadedA.snapshot().assignments.map((item) => item.userId)).toEqual([
      "user_owner_a",
    ]);
    expect(loadedA.snapshot().assignments.map((item) => item.userId)).not.toContain(
      "user_owner_b",
    );
    expect(loadedB.snapshot().customRoles.map((role) => role.id)).toEqual([
      "role_copy_b",
    ]);
    expect(await repository.load("organization_company_missing")).toBeNull();
  });

  it("given a saved authorization, when its snapshot is read, then it stores no PIN", async () => {
    const repository = await createRepository();
    const authorization = storedAuthorization("pin");

    await repository.save(authorization, changed(authorization));

    const stored = await repository.load(authorization.tenantId);
    expect(stored).toBeInstanceOf(Authorization);
    if (!(stored instanceof Authorization)) {
      return;
    }
    expect(containsPin(stored.snapshot())).toBe(false);
    expect(JSON.stringify(stored.snapshot())).not.toMatch(/pinHash|pin_hash/i);
  });
}
