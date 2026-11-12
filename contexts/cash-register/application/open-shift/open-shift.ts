import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { CashShift } from "#domain/cash-shift.js";

export interface OpenShiftInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  shiftId: string;
  cashierId: string;
  openingFloatCop: number;
}

export interface PendingQrPaymentDrain {
  applyPending(input: {
    tenantId: string;
    venueId: string;
    registerId: string;
  }): Promise<void>;
}

const knownRegister = async (
  lookup: RegisterLookup,
  tenantId: string,
  venueId: string,
  registerId: string,
): Promise<void> => {
  const known = await lookup.find(tenantId, venueId, registerId);

  if (known === null || known.id !== registerId || known.venueId !== venueId) {
    throw new UnknownRegister();
  }
};

export class OpenShift {
  constructor(
    private readonly registers: CashRegisterRepository,
    private readonly registerLookup: RegisterLookup,
    private readonly pendingQrPayments: PendingQrPaymentDrain | null = null,
  ) {}

  async execute(input: OpenShiftInput): Promise<CashShift> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const existing = await this.registers.load(
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const shift = existing ?? CashShift.forRegister(input.registerId);

    shift.open({
      id: input.shiftId,
      cashierId: input.cashierId,
      openingFloatCop: input.openingFloatCop,
    });
    await this.registers.save(input.tenantId, input.venueId, shift);

    if (this.pendingQrPayments) {
      await this.pendingQrPayments.applyPending({
        tenantId: input.tenantId,
        venueId: input.venueId,
        registerId: input.registerId,
      });
    }

    return shift;
  }
}
