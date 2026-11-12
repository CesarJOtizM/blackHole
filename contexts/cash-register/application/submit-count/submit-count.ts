import type { CashCountStore } from "#application/ports/cash-count-store.js";
import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import type {
  GatewayReportRow,
  PaymentGateway,
} from "#application/ports/payment-gateway.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { OpenShiftRequired } from "#application/record-movement/record-movement.js";
import {
  CashCount,
  type CountState,
  type DenominationLine,
  type TerminalReport,
} from "#domain/cash-count.js";
import type { CashShift } from "#domain/cash-shift.js";

export class RecountRejected extends Error {
  constructor() {
    super("A recount is allowed only while the shift is counting.");
    this.name = "RecountRejected";
  }
}

export interface ReadCountInput {
  tenantId: string;
  venueId: string;
  registerId: string;
}

export interface SubmitCountInput extends ReadCountInput {
  countId: string;
  countedBy: string;
  denominations: readonly DenominationLine[];
  terminals: readonly TerminalReport[];
}

export interface CountReading {
  state: CountState;
  expectedCashCop: number | undefined;
  countedCashCop: number | undefined;
  differenceCop: number | undefined;
  qrCop?: number;
  qrReportCop?: number;
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

const hiddenReading = (): CountReading => ({
  state: "open",
  expectedCashCop: undefined,
  countedCashCop: undefined,
  differenceCop: undefined,
});

const readingOf = (count: CashCount): CountReading => {
  const reading: CountReading = {
    state: count.state,
    expectedCashCop: count.expectedCashCop,
    countedCashCop: count.countedCashCop,
    differenceCop: count.differenceCop,
  };

  if (count.qrCop !== undefined) {
    reading.qrCop = count.qrCop;
    reading.qrReportCop = count.qrReportCop;
  }

  return reading;
};

const qrRecordedCop = (shift: CashShift): number =>
  shift.payments.reduce(
    (total, payment) =>
      payment.method === "qr" ? total + payment.amountCop : total,
    0,
  );

const qrReportedCop = (rows: readonly GatewayReportRow[]): number =>
  rows.reduce((total, row) => total + row.amountCop, 0);

export class SubmitCount {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly registers: CashRegisterRepository,
    private readonly counts: CashCountStore,
    private readonly gateway: PaymentGateway | null = null,
  ) {}

  async read(input: ReadCountInput): Promise<CountReading> {
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
      return hiddenReading();
    }

    return readingOf(count);
  }

  async execute(input: SubmitCountInput): Promise<CashCount> {
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

    if (existing?.state === "closed") {
      existing.submit({
        denominations: input.denominations,
        expectedCashCop: existing.expectedCashCop ?? 0,
        terminals: input.terminals,
      });
    }

    if (
      existing !== null &&
      existing.expectedCashCop !== undefined &&
      existing.state !== "counting"
    ) {
      throw new RecountRejected();
    }

    const shift = await this.registers.load(
      input.tenantId,
      input.venueId,
      input.registerId,
    );

    if (!shift || shift.expectedCashCop === undefined) {
      throw new OpenShiftRequired();
    }

    const count =
      existing ??
      CashCount.start({
        id: input.countId,
        countedBy: input.countedBy,
      });

    const qr =
      this.gateway === null
        ? {}
        : {
            qrCop: qrRecordedCop(shift),
            qrReportCop: qrReportedCop(
              await this.gateway.report({
                tenantId: input.tenantId,
                venueId: input.venueId,
              }),
            ),
          };

    count.submit({
      denominations: input.denominations,
      expectedCashCop: shift.expectedCashCop,
      terminals: input.terminals,
      ...qr,
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
