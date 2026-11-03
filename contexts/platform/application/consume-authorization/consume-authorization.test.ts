import { expect, it } from "vitest";

import { FakeAuthorizationClock } from "#adapters/memory/authorization-doubles.js";
import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import { ConsumeAuthorization } from "#application/consume-authorization/consume-authorization.js";
import {
  Authorization,
  AuthorizationAlreadyConsumed,
} from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const OWNER_ID = "user_owner";
const SITE_1 = "organization_venue_1";
const ACCOUNT_A = "account_a";
const REQUEST_ID = "request_discount";
const AT = 1_700_000_000_000;
const CONSUMED_AT = AT + 1;

const harness = () => {
  const authorizations = new InMemoryAuthorizationRepository();
  const clock = new FakeAuthorizationClock(CONSUMED_AT);
  const consume = new ConsumeAuthorization(authorizations, clock);

  return { authorizations, consume };
};

const approvedDiscount = (): Authorization => {
  const authorization = Authorization.open(TENANT_ID);

  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.requestAuthorization({
    requestId: REQUEST_ID,
    requesterId: "user_cashier",
    permission: PERMISSION.SALE_DISCOUNT,
    venueId: SITE_1,
    targetId: ACCOUNT_A,
    value: 10,
    reason: "guest",
    expiresAt: AT + 60_000,
    shiftTotals: { waiterVoidsBeforeKitchen: 0, compShiftCop: 0 },
  });
  authorization.resolveAuthorization({
    requestId: REQUEST_ID,
    authorizerId: OWNER_ID,
    deviceId: "device_owner",
    shiftId: "shift_1",
    at: AT,
    approved: true,
    authorizerAssignmentCount: 1,
  });

  return authorization;
};

it("given a consumed discount whose write failed, when that grant is consumed again, then a new grant is required", async () => {
  const { authorizations, consume } = harness();
  const authorization = approvedDiscount();
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  const recorded = await authorizations.eventsFor(TENANT_ID);
  await consume.execute({
    tenantId: TENANT_ID,
    authorizationId: REQUEST_ID,
    permission: PERMISSION.SALE_DISCOUNT,
    targetId: ACCOUNT_A,
    value: 10,
  });

  const again = consume.execute({
    tenantId: TENANT_ID,
    authorizationId: REQUEST_ID,
    permission: PERMISSION.SALE_DISCOUNT,
    targetId: ACCOUNT_A,
    value: 10,
  });

  await expect(again).rejects.toBeInstanceOf(AuthorizationAlreadyConsumed);
  const events = await authorizations.eventsFor(TENANT_ID);
  expect(events).toHaveLength(recorded.length + 1);
  expect(events.at(-1)?.before.requests[0]?.consumedAt).toBeNull();
  expect(events.at(-1)?.after.requests[0]?.consumedAt).toBe(CONSUMED_AT);
});
