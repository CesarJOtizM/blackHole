import type { CashCountStore } from "#application/ports/cash-count-store.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import {
  CashCount,
  ShiftClosed,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";
import { InvalidCashAmount } from "#domain/cash-shift.js";

export interface CloseShiftScope {
  tenantId: string;
  venueId: string;
  registerId: string;
}

export interface PartialCloseInput extends CloseShiftScope {
  countId: string;
  countedBy: string;
}

export interface FinalCloseInput extends CloseShiftScope {
  varianceCop: number;
}

export interface CorrectShiftInput extends CloseShiftScope {
  movementId: string;
  referencesId: string;
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

export class CloseShift {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly counts: CashCountStore,
  ) {}

  async partial(input: PartialCloseInput): Promise<CashCount> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const existing = await this.counts.find(
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const count =
      existing ??
      CashCount.start({
        id: input.countId,
        countedBy: input.countedBy,
      });

    count.partialClose();
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );

    return count;
  }

  async final(input: FinalCloseInput): Promise<CashCount> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const count = await this.load(input);

    assertWithinCap(count, input.varianceCop);
    count.finalClose();
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );

    return count;
  }

  async correct(input: CorrectShiftInput): Promise<CashCount> {
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
      throw new ShiftClosed();
    }

    count.correct({
      id: input.movementId,
      referencesId: input.referencesId,
      amountCop: input.amountCop,
      reason: input.reason,
    });
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );

    return count;
  }

  async changePayment(input: CloseShiftScope): Promise<void> {
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
      throw new ShiftClosed();
    }

    count.editPayment();
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );
  }

  async receiveCharge(input: CloseShiftScope): Promise<void> {
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
      return;
    }

    count.recordCharge();
    await this.counts.save(
      input.tenantId,
      input.venueId,
      input.registerId,
      count,
    );
  }

  private async load(input: CloseShiftScope): Promise<CashCount> {
    const count = await this.counts.find(
      input.tenantId,
      input.venueId,
      input.registerId,
    );

    if (count === null) {
      throw new VarianceNeedsApproval();
    }

    return count;
  }
}
