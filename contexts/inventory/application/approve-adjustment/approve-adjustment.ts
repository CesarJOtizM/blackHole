import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";

import {
  COUNT_LINE_ROLE,
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountSession,
  type CountSessionLine,
  type StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

export class UnknownCountSession extends Error {
  constructor() {
    super("The count session is not pending for this company.");
    this.name = "UnknownCountSession";
  }
}

export interface ApproveAdjustmentInput {
  tenantId: string;
  venueId: string;
  documentId: string;
  countedBy: string;
  actorId: string;
  sessionId: string;
  deviceId: string;
  occurredAt: string;
  decision: "approve" | "reject";
  openRecount?: boolean;
  recountDocumentId?: string;
}

export interface PostedAdjustmentLine {
  movementId: string;
  ingredientId: string;
  quantity: number;
  valueCop: number;
  averageCost: number;
}

export interface PostedAdjustment {
  posted: true;
  valueCop: number;
  lines: readonly PostedAdjustmentLine[];
}

export interface AdjustmentNeedsAuthorizer {
  posted: false;
  outcome: "requires_authorization";
  exceededLimit: { code: string; cap: number; unit: string } | null;
}

export interface AdjustmentDenied {
  posted: false;
  outcome: "denied";
}

export interface AdjustmentRejected {
  posted: false;
  outcome: "rejected";
  recountMayOpen: true;
  recountDocumentId: string | null;
}

export type ApproveAdjustmentResult =
  | PostedAdjustment
  | AdjustmentNeedsAuthorizer
  | AdjustmentDenied
  | AdjustmentRejected;

interface CountSessionReader {
  sessionOf(tenantId: string, documentId: string): Promise<CountSession | null>;
}

const lineId = (documentId: string, ingredientId: string): string =>
  `movement_${documentId}_${ingredientId}`;

export class ApproveAdjustment {
  constructor(
    private readonly permissions: EvaluatePermission,
    private readonly counts: StockCountRepository & CountSessionReader,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    input: ApproveAdjustmentInput,
  ): Promise<ApproveAdjustmentResult> {
    const session = await this.pending(input);
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_APPROVE_COUNT,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: session.valueCop,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      selfAuthorizationAttempt: input.actorId === input.countedBy,
    });

    if (decision.outcome === "requires_authorization") {
      return {
        posted: false,
        outcome: "requires_authorization",
        exceededLimit: decision.exceededLimit,
      };
    }

    if (decision.outcome !== "allowed") {
      return { posted: false, outcome: "denied" };
    }

    if (input.decision === "reject") {
      return this.reject(input, session);
    }

    return this.approve(input, session);
  }

  private async pending(input: ApproveAdjustmentInput): Promise<CountSession> {
    const session = await this.counts.sessionOf(
      input.tenantId,
      input.documentId,
    );

    if (
      session === null ||
      session.tenantId !== input.tenantId ||
      session.venueId !== input.venueId ||
      session.status !== COUNT_SESSION_STATUS.PENDING
    ) {
      throw new UnknownCountSession();
    }

    return session;
  }

  private async reject(
    input: ApproveAdjustmentInput,
    session: CountSession,
  ): Promise<AdjustmentRejected> {
    const recountDocumentId = this.recountDocumentId(input);

    if (recountDocumentId !== null) {
      await this.counts.saveSession({
        tenantId: session.tenantId,
        venueId: session.venueId,
        locationId: session.locationId,
        documentId: recountDocumentId,
        cutOff: session.cutOff,
        status: COUNT_SESSION_STATUS.PENDING,
        lines: session.lines.map((line) => ({ ...line })),
        valueCop: session.valueCop,
      });
    }

    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: this.authorizerId(input),
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.INVENTORY_APPROVE_COUNT,
      entity: input.documentId,
      before: this.before(session),
      after: {
        status: COUNT_SESSION_STATUS.PENDING,
        movements: 0,
        recountDocumentId,
      },
      reason: "rejected",
    });

    return {
      posted: false,
      outcome: "rejected",
      recountMayOpen: true,
      recountDocumentId,
    };
  }

  private async approve(
    input: ApproveAdjustmentInput,
    session: CountSession,
  ): Promise<PostedAdjustment> {
    // Frozen quantity and average cost are copied. This path does not recompute them.
    const movements = session.lines.map((line) =>
      postedLine(input, session, line),
    );
    const ledger = StockLedger.open({
      tenantId: input.tenantId,
      locationId: session.locationId,
    });

    for (const movement of movements) {
      ledger.append({
        id: movement.id,
        ingredientId: movement.ingredientId,
        quantity: movement.quantity,
        unitCost: movement.unitCost,
        type: movement.type,
        reference: movement.reference,
        occurredAt: movement.occurredAt,
      });
    }

    if (movements.length > 0) {
      await this.counts.appendAdjustments(movements);
    }

    const lines = session.lines.map((line) => postedView(input, line));

    await this.counts.saveSession({
      tenantId: session.tenantId,
      venueId: session.venueId,
      locationId: session.locationId,
      documentId: session.documentId,
      cutOff: session.cutOff,
      status: COUNT_SESSION_STATUS.POSTED,
      lines: session.lines.map((line) => ({ ...line })),
      valueCop: session.valueCop,
    });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: this.authorizerId(input),
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.INVENTORY_APPROVE_COUNT,
      entity: input.documentId,
      before: this.before(session),
      after: {
        status: COUNT_SESSION_STATUS.POSTED,
        lines,
      },
      reason: "approved",
    });

    return {
      posted: true,
      valueCop: session.valueCop,
      lines,
    };
  }

  private recountDocumentId(input: ApproveAdjustmentInput): string | null {
    if (
      input.openRecount !== true ||
      input.recountDocumentId === undefined ||
      input.recountDocumentId.length === 0
    ) {
      return null;
    }

    return input.recountDocumentId;
  }

  private authorizerId(input: ApproveAdjustmentInput): string | null {
    if (input.actorId === input.countedBy) {
      return null;
    }

    return input.actorId;
  }

  private before(session: CountSession): {
    status: CountSession["status"];
    valueCop: number;
    lines: CountSessionLine[];
  } {
    return {
      status: COUNT_SESSION_STATUS.PENDING,
      valueCop: session.valueCop,
      lines: session.lines.map((line) => ({ ...line })),
    };
  }
}

function postedView(
  input: ApproveAdjustmentInput,
  line: CountSessionLine,
): PostedAdjustmentLine {
  return {
    movementId: lineId(input.documentId, line.ingredientId),
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    valueCop: line.valueCop,
    averageCost: line.averageCost,
  };
}

function postedLine(
  input: ApproveAdjustmentInput,
  session: CountSession,
  line: CountSessionLine,
): CountLedgerLine {
  return {
    id: lineId(input.documentId, line.ingredientId),
    tenantId: input.tenantId,
    venueId: session.venueId,
    locationId: session.locationId,
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.averageCost,
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    reference: input.documentId,
    occurredAt: input.occurredAt,
    orderLineId: input.documentId,
    role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
    recipeVersion: 0,
    reason: null,
    actorId: input.actorId,
  };
}
