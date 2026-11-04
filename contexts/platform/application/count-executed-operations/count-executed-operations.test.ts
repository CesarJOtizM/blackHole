import { expect, it } from "vitest";

import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import { CountExecutedOperations } from "#application/count-executed-operations/count-executed-operations.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const ACTOR_ID = "user_waiter";
const SHIFT_ID = "shift_1";
const GENESIS = "0".repeat(64);

const executed = (
  value: number,
  shiftId: string,
  kitchen: "before" | "after" | null,
) => ({
  value,
  shiftId,
  kitchen,
});

let sequence = 0;

const event = (
  action: string,
  before: unknown,
  after: unknown,
  overrides: Partial<AuditEvent> = {},
): AuditEvent => {
  sequence += 1;

  return {
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    authorizerId: null,
    deviceId: "device_register",
    siteId: "organization_venue_1",
    action,
    entity: "check_1",
    before,
    after,
    reason: action,
    occurredAt: 1_700_000_000_000,
    sequence,
    previousHash: GENESIS,
    digest: "ab".repeat(32),
    kind: "event",
    ...overrides,
  };
};

it("given a failed PIN, a denied decision, and an unchanged audit beside executed operations, when the shift is counted, then only the successful audits count", async () => {
  const audits = new InMemoryAuditRepository();
  const count = new CountExecutedOperations(audits);
  const voidBefore = PERMISSION.SALE_VOID_BEFORE_KITCHEN;
  const courtesy = PERMISSION.SALE_COMP;
  await audits.append(
    event(
      voidBefore,
      executed(0, SHIFT_ID, "before"),
      executed(1, SHIFT_ID, "before"),
    ),
  );
  await audits.append(
    event(
      courtesy,
      executed(0, SHIFT_ID, null),
      executed(20_000, SHIFT_ID, null),
    ),
  );
  await audits.append(
    event(
      "pin.confirmation-failed",
      { attempts: 0 },
      { ...executed(1, SHIFT_ID, "before"), attempts: 1 },
    ),
  );
  await audits.append(
    event(voidBefore, executed(0, SHIFT_ID, "before"), {
      ...executed(1, SHIFT_ID, "before"),
      approved: false,
    }),
  );
  await audits.append(
    event(
      voidBefore,
      executed(1, SHIFT_ID, "before"),
      executed(1, SHIFT_ID, "before"),
    ),
  );
  await audits.append(
    event(
      voidBefore,
      executed(0, SHIFT_ID, "before"),
      executed(1, SHIFT_ID, "before"),
      { actorId: "user_other" },
    ),
  );
  await audits.append(
    event(
      courtesy,
      executed(0, "shift_other", null),
      executed(20_000, "shift_other", null),
    ),
  );
  await audits.append(
    event(
      voidBefore,
      executed(0, SHIFT_ID, "before"),
      executed(1, SHIFT_ID, "before"),
      { kind: "altered" },
    ),
  );

  const totals = await count.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    shiftId: SHIFT_ID,
  });

  expect(totals).toEqual({
    waiterVoidsBeforeKitchen: 1,
    compShiftCop: 20_000,
  });
});
