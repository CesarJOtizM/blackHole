import {
  Authorization,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import { ApproveAdjustment } from "#application/approve-adjustment/approve-adjustment.js";
import {
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountSession,
  type CountSessionLine,
  StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";
const CHEESE_ID = "ingredient_cheese";
const OWNER_ID = "user_owner";
const SITE_ADMIN_ID = "user_site_administrator";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const CUT_OFF = "2026-11-13T18:00:00.000Z";
const APPROVED_AT = "2026-11-13T21:00:00.000Z";
const SHIFT_ID = "shift_count_1";
const AVERAGE_COST = 1_500;
const LATER_COST = 4_500;
const FROZEN_VALUE = 1_500;

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const movementId = (documentId: string, ingredientId: string): string =>
  `movement_${documentId}_${ingredientId}`;

const FROZEN_LINES: readonly CountSessionLine[] = [
  {
    ingredientId: MILK_ID,
    quantity: -grams(600),
    averageCost: AVERAGE_COST,
    valueCop: 900,
  },
  {
    ingredientId: CHEESE_ID,
    quantity: -grams(400),
    averageCost: AVERAGE_COST,
    valueCop: 600,
  },
];

class MemoryCounts extends StockCountRepository {
  readonly appended: CountLedgerLine[] = [];
  readonly saved: CountSession[] = [];
  movementReads = 0;
  private readonly sessions = new Map<string, CountSession>();

  remember(session: CountSession): void {
    this.sessions.set(this.key(session.tenantId, session.documentId), {
      ...session,
      lines: session.lines.map((line) => ({ ...line })),
    });
  }

  override async movementsAt(
    _tenantId: string,
    _venueId: string,
    _locationId: string,
  ): Promise<readonly CountLedgerLine[]> {
    this.movementReads += 1;
    return [];
  }

  override async appendAdjustments(
    lines: readonly CountLedgerLine[],
  ): Promise<void> {
    for (const line of lines) {
      this.appended.push({ ...line });
    }
  }

  override async saveSession(session: CountSession): Promise<void> {
    const copy: CountSession = {
      ...session,
      lines: session.lines.map((line) => ({ ...line })),
    };
    this.saved.push(copy);
    this.sessions.set(this.key(session.tenantId, session.documentId), copy);
  }

  async sessionOf(
    tenantId: string,
    documentId: string,
  ): Promise<CountSession | null> {
    const session = this.sessions.get(this.key(tenantId, documentId));

    if (session === undefined || session.tenantId !== tenantId) {
      return null;
    }

    return {
      ...session,
      lines: session.lines.map((line) => ({ ...line })),
    };
  }

  private key(tenantId: string, documentId: string): string {
    return `${tenantId}\u0000${documentId}`;
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

class ApprovalPermission extends EvaluatePermission {
  readonly calls: Array<Parameters<EvaluatePermission["execute"]>[0]> = [];

  constructor(
    private readonly authorization: Authorization,
    private readonly userId: string,
    private readonly shiftId: string | null,
  ) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(
    input: Parameters<EvaluatePermission["execute"]>[0],
  ): ReturnType<EvaluatePermission["execute"]> {
    this.calls.push(input);

    return Promise.resolve(
      this.authorization.evaluateFor(this.userId, {
        permission: input.permission,
        at: 0,
        target: input.target,
        value: input.value,
        shiftTotals: input.shiftTotals,
        selfAuthorizationAttempt: input.selfAuthorizationAttempt ?? false,
        shiftId: this.shiftId,
      }),
    );
  }
}

const ownerAuthorization = (): Authorization => {
  const authorization = Authorization.open(TENANT_A);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });

  return authorization;
};

const soleApprover = (shiftEnabled: boolean): Authorization => {
  const authorization = ownerAuthorization();
  authorization.assign({
    assignmentId: "assignment_site_admin",
    userId: SITE_ADMIN_ID,
    roleId: "siteAdministrator",
    scopeKind: "site",
    scopeId: VENUE_ID,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });

  if (shiftEnabled) {
    authorization.enableShiftSelfAuthorization({
      id: "shift_flag_count",
      venueId: VENUE_ID,
      shiftId: SHIFT_ID,
      enabled: true,
      actorUserId: OWNER_ID,
      at: 0,
    });
  }

  const snapshot = authorization.snapshot();

  return Authorization.restore({
    ...snapshot,
    assignments: snapshot.assignments.filter(
      (assignment) => assignment.userId === SITE_ADMIN_ID,
    ),
  });
};

const pending = (documentId: string): CountSession => ({
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  documentId,
  cutOff: CUT_OFF,
  status: COUNT_SESSION_STATUS.PENDING,
  lines: FROZEN_LINES.map((line) => ({ ...line })),
  valueCop: FROZEN_VALUE,
});

const harness = (input: {
  authorization: Authorization;
  userId: string;
  shiftId: string | null;
  documentId: string;
}) => {
  const counts = new MemoryCounts();
  const session = pending(input.documentId);
  counts.remember(session);
  const audits = new CapturedAudit();
  const permissions = new ApprovalPermission(
    input.authorization,
    input.userId,
    input.shiftId,
  );
  const useCase = new ApproveAdjustment(permissions, counts, audits);

  return { counts, audits, permissions, useCase, session };
};

const command = (
  documentId: string,
  actorId: string,
  sessionId: string,
  countedBy: string,
  decision: "approve" | "reject",
  recountDocumentId?: string,
) => ({
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  documentId,
  countedBy,
  actorId,
  sessionId,
  deviceId: "device_office",
  occurredAt: APPROVED_AT,
  decision,
  ...(recountDocumentId === undefined
    ? {}
    : { openRecount: true, recountDocumentId }),
});

const postedLine = (
  documentId: string,
  line: CountSessionLine,
  actorId: string,
): CountLedgerLine => ({
  id: movementId(documentId, line.ingredientId),
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: line.ingredientId,
  quantity: line.quantity,
  unitCost: line.averageCost,
  type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
  reference: documentId,
  occurredAt: APPROVED_AT,
  orderLineId: documentId,
  role: "count_adjustment",
  recipeVersion: 0,
  reason: null,
  actorId,
});

it("given a pending count frozen above the cap, when a role allowed to approve count results approves it, then the frozen lines post and a later cost is ignored", async () => {
  const documentId = "count_milk_approved";
  const { counts, audits, permissions, useCase, session } = harness({
    authorization: ownerAuthorization(),
    userId: OWNER_ID,
    shiftId: null,
    documentId,
  });
  const recomputed = nextAverageCost({
    onHand: grams(7400),
    averageCost: AVERAGE_COST,
    receivedQuantity: grams(1000),
    receiptCost: LATER_COST,
  });

  const result = await useCase.execute(
    command(documentId, OWNER_ID, "session_owner", KITCHEN_CHIEF_ID, "approve"),
  );

  expect(result).toEqual({
    posted: true,
    valueCop: FROZEN_VALUE,
    lines: FROZEN_LINES.map((line) => ({
      movementId: movementId(documentId, line.ingredientId),
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      valueCop: line.valueCop,
      averageCost: line.averageCost,
    })),
  });
  expect(counts.appended).toEqual(
    FROZEN_LINES.map((line) => postedLine(documentId, line, OWNER_ID)),
  );
  expect(counts.appended[0]).not.toHaveProperty("reversesMovementId");
  expect(counts.appended.every((line) => line.unitCost === AVERAGE_COST)).toBe(
    true,
  );
  expect(counts.appended.some((line) => line.unitCost === recomputed)).toBe(
    false,
  );
  expect(counts.movementReads).toBe(0);
  expect(counts.saved).toEqual([
    { ...session, status: COUNT_SESSION_STATUS.POSTED },
  ]);
  expect(permissions.calls).toEqual([
    {
      tenantId: TENANT_A,
      sessionId: "session_owner",
      permission: PERMISSION.INVENTORY_APPROVE_COUNT,
      target: { kind: "site", id: VENUE_ID, brandId: null },
      value: FROZEN_VALUE,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      selfAuthorizationAttempt: false,
    },
  ]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_A,
      actorId: OWNER_ID,
      authorizerId: OWNER_ID,
      deviceId: "device_office",
      siteId: VENUE_ID,
      action: PERMISSION.INVENTORY_APPROVE_COUNT,
      entity: documentId,
      before: {
        status: COUNT_SESSION_STATUS.PENDING,
        valueCop: FROZEN_VALUE,
        lines: FROZEN_LINES,
      },
      after: {
        status: COUNT_SESSION_STATUS.POSTED,
        lines: FROZEN_LINES.map((line) => ({
          movementId: movementId(documentId, line.ingredientId),
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          valueCop: line.valueCop,
          averageCost: line.averageCost,
        })),
      },
      reason: "approved",
    },
  ]);
});

it("given a pending count above the cap, when it is rejected, then the audit is stored, stock is unchanged, and a recount may open", async () => {
  const documentId = "count_milk_rejected";
  const recountDocumentId = "count_milk_recount";
  const { counts, audits, useCase, session } = harness({
    authorization: ownerAuthorization(),
    userId: OWNER_ID,
    shiftId: null,
    documentId,
  });

  const result = await useCase.execute(
    command(
      documentId,
      OWNER_ID,
      "session_owner",
      KITCHEN_CHIEF_ID,
      "reject",
      recountDocumentId,
    ),
  );

  expect(result).toEqual({
    posted: false,
    outcome: "rejected",
    recountMayOpen: true,
    recountDocumentId,
  });
  expect(counts.appended).toEqual([]);
  expect(counts.movementReads).toBe(0);
  expect(await counts.sessionOf(TENANT_A, documentId)).toEqual(session);
  expect(await counts.sessionOf(TENANT_B, documentId)).toBeNull();
  expect(counts.saved).toEqual([
    {
      ...session,
      documentId: recountDocumentId,
      status: COUNT_SESSION_STATUS.PENDING,
    },
  ]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_A,
      actorId: OWNER_ID,
      authorizerId: OWNER_ID,
      deviceId: "device_office",
      siteId: VENUE_ID,
      action: PERMISSION.INVENTORY_APPROVE_COUNT,
      entity: documentId,
      before: {
        status: COUNT_SESSION_STATUS.PENDING,
        valueCop: FROZEN_VALUE,
        lines: FROZEN_LINES,
      },
      after: {
        status: COUNT_SESSION_STATUS.PENDING,
        movements: 0,
        recountDocumentId,
      },
      reason: "rejected",
    },
  ]);
});

it("given the counter is the only approver, when they approve without shift self-authorization, then approval is denied and stock is unchanged", async () => {
  const documentId = "count_milk_self_denied";
  const { counts, audits, permissions, useCase } = harness({
    authorization: soleApprover(false),
    userId: SITE_ADMIN_ID,
    shiftId: SHIFT_ID,
    documentId,
  });

  const result = await useCase.execute(
    command(
      documentId,
      SITE_ADMIN_ID,
      "session_site_admin",
      SITE_ADMIN_ID,
      "approve",
    ),
  );

  expect(result).toEqual({ posted: false, outcome: "denied" });
  expect(permissions.calls[0]?.selfAuthorizationAttempt).toBe(true);
  expect(permissions.calls[0]?.permission).toBe(
    PERMISSION.INVENTORY_APPROVE_COUNT,
  );
  expect(permissions.calls[0]?.value).toBe(FROZEN_VALUE);
  expect(counts.appended).toEqual([]);
  expect(counts.saved).toEqual([]);
  expect(counts.movementReads).toBe(0);
  expect(audits.commands).toEqual([]);
  expect(await counts.sessionOf(TENANT_A, documentId)).toMatchObject({
    status: COUNT_SESSION_STATUS.PENDING,
    valueCop: FROZEN_VALUE,
  });
});

it("given the counter is the only approver and the shift allows self-authorization, when they approve, then the frozen lines post", async () => {
  const documentId = "count_milk_self_allowed";
  const { counts, audits, permissions, useCase } = harness({
    authorization: soleApprover(true),
    userId: SITE_ADMIN_ID,
    shiftId: SHIFT_ID,
    documentId,
  });

  const result = await useCase.execute(
    command(
      documentId,
      SITE_ADMIN_ID,
      "session_site_admin",
      SITE_ADMIN_ID,
      "approve",
    ),
  );

  expect(result).toEqual({
    posted: true,
    valueCop: FROZEN_VALUE,
    lines: FROZEN_LINES.map((line) => ({
      movementId: movementId(documentId, line.ingredientId),
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      valueCop: line.valueCop,
      averageCost: line.averageCost,
    })),
  });
  expect(permissions.calls[0]?.selfAuthorizationAttempt).toBe(true);
  expect(counts.appended).toEqual(
    FROZEN_LINES.map((line) => postedLine(documentId, line, SITE_ADMIN_ID)),
  );
  expect(counts.saved).toEqual([
    {
      ...pending(documentId),
      status: COUNT_SESSION_STATUS.POSTED,
    },
  ]);
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_A,
      actorId: SITE_ADMIN_ID,
      authorizerId: null,
      deviceId: "device_office",
      siteId: VENUE_ID,
      action: PERMISSION.INVENTORY_APPROVE_COUNT,
      entity: documentId,
      before: {
        status: COUNT_SESSION_STATUS.PENDING,
        valueCop: FROZEN_VALUE,
        lines: FROZEN_LINES,
      },
      after: {
        status: COUNT_SESSION_STATUS.POSTED,
        lines: FROZEN_LINES.map((line) => ({
          movementId: movementId(documentId, line.ingredientId),
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          valueCop: line.valueCop,
          averageCost: line.averageCost,
        })),
      },
      reason: "approved",
    },
  ]);
});
