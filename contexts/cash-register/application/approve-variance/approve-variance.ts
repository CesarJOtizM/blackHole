import type { CashCountStore } from "#application/ports/cash-count-store.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { type CashCount, VarianceNeedsApproval } from "#domain/cash-count.js";
import { InvalidCashAmount } from "#domain/cash-shift.js";

export interface ApproveVarianceInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  approverId: string;
  justification: string;
  varianceCop: number;
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

const gapCop = (count: CashCount): number => {
  const cashGap = Math.abs(count.differenceCop ?? 0);
  const terminalGap = count.terminalDifferences.reduce(
    (largest, terminal) => Math.max(largest, Math.abs(terminal.differenceCop)),
    0,
  );

  return Math.max(cashGap, terminalGap);
};

const assertWithinCap = (count: CashCount, varianceCop: number): void => {
  if (!Number.isInteger(varianceCop) || varianceCop < 0) {
    throw new InvalidCashAmount();
  }

  if (gapCop(count) > varianceCop) {
    throw new VarianceNeedsApproval();
  }
};

export class ApproveVariance {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly counts: CashCountStore,
  ) {}

  async execute(input: ApproveVarianceInput): Promise<CashCount> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const count = await this.counts.find(
      input.tenantId,
      input.venueId,
      input.registerId,
    );

    if (count === null) {
      throw new VarianceNeedsApproval();
    }

    assertWithinCap(count, input.varianceCop);
    count.approve({
      approverId: input.approverId,
      justification: input.justification,
    });
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );

    return count;
  }
}
