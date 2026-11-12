import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import {
  type AppliedQrOrder,
  type ApplyQrOrder,
  QrIntentMissing,
  toAppliedQrOrder,
} from "#application/apply-qr-order/apply-qr-order.js";
import type { QrOrderIntentRepository } from "#application/ports/qr-order-intent-repository.js";

export class QrReviewRefused extends Error {
  constructor() {
    super("Reviewing a QR order requires sale.charge.");
    this.name = "QrReviewRefused";
  }
}

export interface ReviewQrOrderIntentInput {
  tenantId: string;
  venueId: string;
  intentId: string;
  sessionId: string;
  decision: "accept" | "reject";
}

export class ReviewQrOrderIntent {
  constructor(
    private readonly intents: QrOrderIntentRepository,
    private readonly permissions: EvaluatePermission,
    private readonly applying: ApplyQrOrder,
  ) {}

  async execute(input: ReviewQrOrderIntentInput): Promise<AppliedQrOrder> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_CHARGE,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new QrReviewRefused();
    }

    const intent = await this.intents.find(input.tenantId, input.intentId);

    if (intent === null || intent.venueId !== input.venueId) {
      throw new QrIntentMissing();
    }

    if (input.decision === "reject") {
      if (intent.status !== "pending_acceptance") {
        return toAppliedQrOrder(intent);
      }

      const rejected = { ...intent, status: "rejected" as const };
      await this.intents.save(rejected);

      return toAppliedQrOrder(rejected);
    }

    return this.applying.execute({
      tenantId: input.tenantId,
      intentId: input.intentId,
      force: true,
    });
  }
}
