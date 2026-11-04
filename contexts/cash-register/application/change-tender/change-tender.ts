import {
  type ConsumeAuthorization,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";

import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import type { CashShift, TenderMethod } from "#domain/cash-shift.js";

export interface OriginalPayment {
  paymentId: string;
  amountCop: number;
  shiftId: string;
}

export abstract class OriginalPaymentReader {
  abstract find(
    tenantId: string,
    venueId: string,
    paymentId: string,
  ): Promise<OriginalPayment | null>;
}

export interface ChangeTenderInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  paymentId: string;
  reversalId: string;
  replacementId: string;
  method: TenderMethod;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  reason: string;
  authorizationId: string | null;
}

const recordChange = (
  audits: RecordAuditEvent,
  input: ChangeTenderInput,
  sale: OriginalPayment,
  shiftId: string,
): Promise<unknown> =>
  audits.execute({
    tenantId: input.tenantId,
    actorId: input.actorId,
    authorizerId: input.authorizerId,
    deviceId: input.deviceId,
    siteId: input.venueId,
    action: PERMISSION.SALE_CHANGE_TENDER,
    entity: sale.paymentId,
    before: { value: 0 },
    after: { value: sale.amountCop, shiftId, kitchen: null },
    reason: input.reason,
  });

interface OpenDestination {
  sale: OriginalPayment;
  shift: CashShift;
  shiftId: string;
}

const openDestination = (
  sale: OriginalPayment | null,
  shift: CashShift | null,
): OpenDestination | null => {
  const shiftId = shift?.id;

  if (
    sale === null ||
    shift === null ||
    shiftId === undefined ||
    shift.state !== "open" ||
    shiftId === sale.shiftId
  ) {
    return null;
  }

  return { sale, shift, shiftId };
};

export class ChangeTender {
  constructor(
    private readonly payments: OriginalPaymentReader,
    private readonly registers: CashRegisterRepository,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ChangeTenderInput): Promise<void> {
    const destination = openDestination(
      await this.payments.find(input.tenantId, input.venueId, input.paymentId),
      await this.registers.load(
        input.tenantId,
        input.venueId,
        input.registerId,
      ),
    );

    if (destination === null) {
      return;
    }

    const shiftTotals = await this.counts.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      shiftId: destination.shiftId,
    });
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_CHANGE_TENDER,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: destination.sale.amountCop,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeGrant(input, destination.sale);

      if (!consumed) {
        return;
      }
    }

    destination.shift.recordReversal({
      id: input.reversalId,
      originalPaymentId: destination.sale.paymentId,
      amountCop: destination.sale.amountCop,
    });
    destination.shift.recordPayment({
      id: input.replacementId,
      originalPaymentId: destination.sale.paymentId,
      method: input.method,
      amountCop: destination.sale.amountCop,
    });
    await this.registers.save(input.tenantId, input.venueId, destination.shift);
    await recordChange(
      this.audits,
      input,
      destination.sale,
      destination.shiftId,
    );
  }

  private async consumeGrant(
    input: ChangeTenderInput,
    sale: OriginalPayment,
  ): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_CHANGE_TENDER,
        targetId: sale.paymentId,
        value: sale.amountCop,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
