import {
  type ConsumeAuthorization,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";

import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import type { CashShift } from "#domain/cash-shift.js";

export interface PaidAccount {
  paymentId: string;
  amountCop: number;
  shiftId: string;
}

export abstract class PaidAccountReader {
  abstract find(
    tenantId: string,
    venueId: string,
    paymentId: string,
  ): Promise<PaidAccount | null>;
}

export interface ReopenPaidAccountInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  paymentId: string;
  reversalId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  reason: string;
  authorizationId: string | null;
}

const recordReopening = (
  audits: RecordAuditEvent,
  input: ReopenPaidAccountInput,
  sale: PaidAccount,
  shiftId: string,
): Promise<unknown> =>
  audits.execute({
    tenantId: input.tenantId,
    actorId: input.actorId,
    authorizerId: input.authorizerId,
    deviceId: input.deviceId,
    siteId: input.venueId,
    action: PERMISSION.SALE_REOPEN_PAID,
    entity: sale.paymentId,
    before: { value: 0 },
    after: { value: sale.amountCop, shiftId, kitchen: null },
    reason: input.reason,
  });

interface OpenDestination {
  sale: PaidAccount;
  shift: CashShift;
  shiftId: string;
}

const openDestination = (
  sale: PaidAccount | null,
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

export class ReopenPaidAccount {
  constructor(
    private readonly accounts: PaidAccountReader,
    private readonly registers: CashRegisterRepository,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ReopenPaidAccountInput): Promise<void> {
    const destination = openDestination(
      await this.accounts.find(input.tenantId, input.venueId, input.paymentId),
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
      permission: PERMISSION.SALE_REOPEN_PAID,
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
    await this.registers.save(input.tenantId, input.venueId, destination.shift);
    await recordReopening(
      this.audits,
      input,
      destination.sale,
      destination.shiftId,
    );
  }

  private async consumeGrant(
    input: ReopenPaidAccountInput,
    sale: PaidAccount,
  ): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_REOPEN_PAID,
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
