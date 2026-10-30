import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import type { CashMovementKind, CashShift } from "#domain/cash-shift.js";

export class OpenShiftRequired extends Error {
  constructor() {
    super("A cash movement requires an open shift.");
    this.name = "OpenShiftRequired";
  }
}

export interface RecordMovementInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  movementId: string;
  kind: CashMovementKind;
  amountCop: number;
  reason: string;
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

export class RecordMovement {
  constructor(
    private readonly registers: CashRegisterRepository,
    private readonly registerLookup: RegisterLookup,
  ) {}

  async execute(input: RecordMovementInput): Promise<CashShift> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const shift = await this.registers.load(
      input.tenantId,
      input.venueId,
      input.registerId,
    );

    if (shift === null || shift.state !== "open") {
      throw new OpenShiftRequired();
    }

    shift.recordMovement({
      id: input.movementId,
      kind: input.kind,
      amountCop: input.amountCop,
      reason: input.reason,
    });
    await this.registers.save(input.tenantId, input.venueId, shift);

    return shift;
  }
}
