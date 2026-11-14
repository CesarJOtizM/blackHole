import {
  Authorization,
  EvaluatePermission,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  ConfirmNoRestockToday,
  NoRestockConfirmationStore,
  type NoRestockMarkQuery,
  NoRestockNotPermitted,
  NoRestockTodayDisabled,
} from "#application/confirm-no-restock-today/confirm-no-restock-today.js";
import { NoRestockToday } from "#domain/no-restock-today.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "venue_site_1";
const RIBS_ID = "product_ribs";
const OWNER_ID = "user_owner";
const WAITER_ID = "user_waiter";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const BEFORE_MIDNIGHT = new Date("2026-11-14T04:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-14T05:01:00.000Z");
const CONFIRM_ACTION = "inventory.confirm-no-restock";

const proposed = (): NoRestockToday => {
  const mark = NoRestockToday.propose({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: RIBS_ID,
    coverage: {
      pointPortions: 0,
      supplyingWarehousePortions: 0,
      inboundTransfers: [{ status: "requested" }],
    },
  });

  if (mark === null) {
    throw new Error("Expected a proposal.");
  }

  return mark;
};

class MemoryMarks extends NoRestockConfirmationStore {
  readonly reads: NoRestockMarkQuery[] = [];

  readonly saved: NoRestockToday[] = [];

  constructor(private readonly mark: NoRestockToday) {
    super();
  }

  override async find(
    query: NoRestockMarkQuery,
  ): Promise<NoRestockToday | null> {
    this.reads.push(query);
    return this.mark;
  }

  override async save(mark: NoRestockToday): Promise<void> {
    this.saved.push(mark);
  }
}

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

class RolePermission extends EvaluatePermission {
  readonly permissions: string[] = [];

  constructor(
    private readonly authorization: Authorization,
    private readonly userId: string,
  ) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(
    input: Parameters<EvaluatePermission["execute"]>[0],
  ): ReturnType<EvaluatePermission["execute"]> {
    this.permissions.push(input.permission);
    return Promise.resolve(
      this.authorization.evaluateFor(this.userId, {
        permission: input.permission,
        at: 0,
        target: input.target,
        value: input.value,
        shiftTotals: input.shiftTotals,
        selfAuthorizationAttempt: input.selfAuthorizationAttempt ?? false,
        shiftId: null,
      }),
    );
  }
}

const staffed = (): Authorization => {
  const authorization = Authorization.open(TENANT_ID);

  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_waiter",
    userId: WAITER_ID,
    roleId: "waiter",
    scopeKind: "site",
    scopeId: VENUE_ID,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  authorization.assign({
    assignmentId: "assignment_kitchen",
    userId: KITCHEN_CHIEF_ID,
    roleId: "kitchenChief",
    scopeKind: "site",
    scopeId: VENUE_ID,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });

  return authorization;
};

const sentLines = () => [
  { id: "line_table_4", productId: RIBS_ID, state: "sent" },
];

const harness = (enabled: boolean, userId: string) => {
  const mark = proposed();
  const marks = new MemoryMarks(mark);
  const permissions = new RolePermission(staffed(), userId);
  const audits = new CapturedAudit();
  const lines = sentLines();
  const movements: unknown[] = [];
  const useCase = new ConfirmNoRestockToday(
    marks,
    permissions,
    audits,
    enabled,
  );

  return {
    mark,
    marks,
    permissions,
    audits,
    lines,
    linesBefore: lines.map((line) => ({ ...line })),
    movements,
    useCase,
  };
};

const command = (
  actorId: string,
  sessionId: string,
  deviceId: string,
  at: Date,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  productId: RIBS_ID,
  actorId,
  sessionId,
  deviceId,
  at,
});

const chiefCommand = (at: Date) =>
  command(KITCHEN_CHIEF_ID, "session_kitchen", "device_kitchen", at);

const waiterCommand = (at: Date) =>
  command(WAITER_ID, "session_waiter", "device_waiter", at);

it("given the flag is off and the service is still open after midnight, when the kitchen chief confirms, then the confirmation is rejected and nothing is written", async () => {
  const {
    mark,
    marks,
    permissions,
    audits,
    lines,
    linesBefore,
    movements,
    useCase,
  } = harness(false, KITCHEN_CHIEF_ID);

  const confirm = useCase.execute(chiefCommand(AFTER_MIDNIGHT));

  await expect(confirm).rejects.toBeInstanceOf(NoRestockTodayDisabled);
  expect(mark.statusAt(AFTER_MIDNIGHT)).toBe("proposed");
  expect(mark.actorId).toBeNull();
  expect(mark.serviceDate).toBeNull();
  expect(mark).not.toHaveProperty("closesAt");
  expect(marks.reads).toEqual([]);
  expect(marks.saved).toEqual([]);
  expect(permissions.permissions).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(lines).toEqual(linesBefore);
  expect(lines[0]?.state).toBe("sent");
  expect(movements).toEqual([]);
});

it("given a proposal, when a waiter confirms, then the waiter is rejected and order lines and stock stay unchanged", async () => {
  const {
    mark,
    marks,
    permissions,
    audits,
    lines,
    linesBefore,
    movements,
    useCase,
  } = harness(true, WAITER_ID);

  const confirm = useCase.execute(waiterCommand(BEFORE_MIDNIGHT));

  await expect(confirm).rejects.toBeInstanceOf(NoRestockNotPermitted);
  expect(mark.statusAt(BEFORE_MIDNIGHT)).toBe("proposed");
  expect(mark.actorId).toBeNull();
  expect(mark.serviceDate).toBeNull();
  expect(marks.saved).toEqual([]);
  expect(permissions.permissions).toEqual([CONFIRM_ACTION]);
  expect(audits.commands).toEqual([]);
  expect(mark).not.toHaveProperty("movements");
  expect(lines).toEqual(linesBefore);
  expect(movements).toEqual([]);
});

it("given a proposal, when the kitchen chief confirms before midnight, then the mark is confirmed for the Bogota date and order lines and stock stay unchanged", async () => {
  const { marks, permissions, audits, lines, linesBefore, movements, useCase } =
    harness(true, KITCHEN_CHIEF_ID);

  const result = await useCase.execute(chiefCommand(BEFORE_MIDNIGHT));

  expect(result.today).toBe("2026-11-13");
  expect(result.mark.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
  expect(result.mark.actorId).toBe(KITCHEN_CHIEF_ID);
  expect(result.mark.serviceDate).toBe("2026-11-13");
  expect(result.mark.statusAt(AFTER_MIDNIGHT)).toBe("expired");
  expect(result.mark).not.toHaveProperty("movements");
  expect(result.mark).not.toHaveProperty("closesAt");
  expect(marks.saved).toEqual([result.mark]);
  expect(permissions.permissions).toEqual([CONFIRM_ACTION]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: KITCHEN_CHIEF_ID,
      authorizerId: null,
      deviceId: "device_kitchen",
      siteId: VENUE_ID,
      action: CONFIRM_ACTION,
      entity: RIBS_ID,
      before: { status: "proposed" },
      after: {
        status: "confirmed",
        productId: RIBS_ID,
        actorId: KITCHEN_CHIEF_ID,
        serviceDate: "2026-11-13",
        tables: [],
      },
      reason: "Not restocked today",
    },
  ]);
  expect(lines).toEqual(linesBefore);
  expect(lines[0]?.state).toBe("sent");
  expect(movements).toEqual([]);
});

it("given a confirmed mark, when the kitchen chief confirms again after midnight, then the retry is idempotent", async () => {
  const { marks, audits, lines, linesBefore, movements, useCase } = harness(
    true,
    KITCHEN_CHIEF_ID,
  );

  const first = await useCase.execute(chiefCommand(BEFORE_MIDNIGHT));
  const second = await useCase.execute(chiefCommand(AFTER_MIDNIGHT));

  expect(second.mark).toBe(first.mark);
  expect(second.today).toBe("2026-11-14");
  expect(second.mark.actorId).toBe(KITCHEN_CHIEF_ID);
  expect(second.mark.serviceDate).toBe("2026-11-13");
  expect(second.mark.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
  expect(second.mark.statusAt(AFTER_MIDNIGHT)).toBe("expired");
  expect(second.mark).not.toHaveProperty("closesAt");
  expect(marks.saved).toEqual([first.mark]);
  expect(audits.commands).toHaveLength(1);
  expect(lines).toEqual(linesBefore);
  expect(movements).toEqual([]);
});
