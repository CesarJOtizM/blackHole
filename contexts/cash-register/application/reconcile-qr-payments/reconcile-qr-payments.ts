import type { PaymentGateway } from "#application/ports/payment-gateway.js";
import type { QrPaymentRepository } from "#application/ports/qr-payment-repository.js";
import type { QrPaymentStatus } from "#domain/qr-payment.js";

const CONFIRMED_STATUSES = [
  "confirmed",
  "pending_application",
  "applied",
] as const satisfies readonly QrPaymentStatus[];

export interface ReconcileQrPaymentsInput {
  tenantId: string;
  venueId: string;
}

export interface QrReportDifference {
  reference: string;
  kind: "missing_in_report" | "amount_mismatch";
  recordedCop: number;
  reportedCop: number | null;
}

export class ReconcileQrPayments {
  constructor(
    private readonly payments: QrPaymentRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(
    input: ReconcileQrPaymentsInput,
  ): Promise<readonly QrReportDifference[]> {
    const stored = (
      await Promise.all(
        CONFIRMED_STATUSES.map((status) =>
          this.payments.listByStatus(input.tenantId, input.venueId, status),
        ),
      )
    ).flat();
    const report = await this.gateway.report({
      tenantId: input.tenantId,
      venueId: input.venueId,
    });
    const reportedCop = new Map(
      report.map((row) => [row.reference, row.amountCop]),
    );
    const differences: QrReportDifference[] = [];

    for (const payment of stored) {
      if (payment.status === "started") {
        continue;
      }

      const reported = reportedCop.get(payment.reference);

      if (reported === undefined) {
        differences.push({
          reference: payment.reference,
          kind: "missing_in_report",
          recordedCop: payment.amountCop,
          reportedCop: null,
        });
        continue;
      }

      if (reported !== payment.amountCop) {
        differences.push({
          reference: payment.reference,
          kind: "amount_mismatch",
          recordedCop: payment.amountCop,
          reportedCop: reported,
        });
      }
    }

    return differences.toSorted((left, right) =>
      left.reference.localeCompare(right.reference),
    );
  }
}
