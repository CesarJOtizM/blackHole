import type {
  AccountGateway,
  AccountLine,
} from "#application/ports/account-gateway.js";
import type { CardTerminal } from "#application/ports/card-terminal.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import {
  Payment,
  type PaymentTender,
  type PaymentTip,
} from "#domain/payment.js";

const CLOSURE_ID_PREFIX = "closure_";

export class InvalidClosureId extends Error {
  constructor() {
    super("A sale closure identifier must use the closure_ prefix.");
    this.name = "InvalidClosureId";
  }
}

export class UnknownAccount extends Error {
  constructor() {
    super("The account is unknown.");
    this.name = "UnknownAccount";
  }
}

export interface SaleClosure {
  id: string;
  status: "queued";
  commandId: string;
  checkId: string;
  tableId: string;
  registerId: string;
  paymentId: string;
  saleCop: number;
  changeCop: number;
  lines: readonly AccountLine[];
  tenders: readonly PaymentTender[];
  tip: PaymentTip;
}

export interface ChargeCheckInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  checkId: string;
  commandId: string;
  paymentId: string;
  closureId: string;
  tenders: readonly PaymentTender[];
  tip?: PaymentTip;
}

export interface RecordedCharge {
  commandId: string;
  payment: Payment;
  closure: SaleClosure;
}

export interface ChargeCheckResult {
  payment: Payment;
  closure: SaleClosure;
}

export abstract class ChargeLedger {
  abstract findByCommand(
    tenantId: string,
    venueId: string,
    commandId: string,
  ): Promise<RecordedCharge | null>;

  abstract insert(
    tenantId: string,
    venueId: string,
    charge: RecordedCharge,
  ): Promise<void>;
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

const assertClosureId = (id: string): void => {
  if (
    !id.startsWith(CLOSURE_ID_PREFIX) ||
    id.length === CLOSURE_ID_PREFIX.length
  ) {
    throw new InvalidClosureId();
  }
};

const capturedTender = async (
  terminal: CardTerminal,
  tender: PaymentTender,
): Promise<PaymentTender> => {
  if (tender.method !== "card") {
    return {
      method: tender.method,
      amountCop: tender.amountCop,
    };
  }

  const captured = await terminal.capture({
    terminal: tender.terminal,
    approvalNumber: tender.approvalNumber,
    brand: tender.brand,
    last4: tender.last4,
  });

  return {
    method: "card",
    amountCop: tender.amountCop,
    terminal: captured.terminal,
    approvalNumber: captured.approvalNumber,
    brand: captured.brand,
    last4: captured.last4,
  };
};

const capturedTip = async (
  terminal: CardTerminal,
  tip: PaymentTip,
): Promise<PaymentTip> => {
  if (tip.method !== "card") {
    return {
      method: tip.method,
      amountCop: tip.amountCop,
    };
  }

  const captured = await terminal.capture({
    terminal: tip.terminal,
    approvalNumber: tip.approvalNumber,
    brand: tip.brand,
    last4: tip.last4,
  });

  return {
    method: "card",
    amountCop: tip.amountCop,
    terminal: captured.terminal,
    approvalNumber: captured.approvalNumber,
    brand: captured.brand,
    last4: captured.last4,
  };
};

export class ChargeCheck {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly accounts: AccountGateway,
    private readonly terminal: CardTerminal,
    private readonly ledger: ChargeLedger,
  ) {}

  async execute(input: ChargeCheckInput): Promise<ChargeCheckResult> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const existing = await this.ledger.findByCommand(
      input.tenantId,
      input.venueId,
      input.commandId,
    );

    if (existing) {
      return { payment: existing.payment, closure: existing.closure };
    }

    assertClosureId(input.closureId);
    const check = await this.accounts.findCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null || check.checkId !== input.checkId) {
      throw new UnknownAccount();
    }

    const tenders: PaymentTender[] = [];

    for (const tender of input.tenders) {
      tenders.push(await capturedTender(this.terminal, tender));
    }

    const tip =
      input.tip === undefined
        ? undefined
        : await capturedTip(this.terminal, input.tip);
    const payment = Payment.record({
      id: input.paymentId,
      accountCop: check.accountCop,
      tenders,
      tip,
    });
    const closure: SaleClosure = {
      id: input.closureId,
      status: "queued",
      commandId: input.commandId,
      checkId: check.checkId,
      tableId: check.tableId,
      registerId: input.registerId,
      paymentId: payment.id,
      saleCop: payment.saleCop,
      changeCop: payment.changeCop,
      lines: check.lines.map((line) => ({
        lineId: line.lineId,
        productId: line.productId,
        priceCop: line.priceCop,
        originTableId: line.originTableId,
        menuClass: line.menuClass,
      })),
      tenders: payment.tenders,
      tip: payment.tip,
    };

    await this.ledger.insert(input.tenantId, input.venueId, {
      commandId: input.commandId,
      payment,
      closure,
    });
    await this.accounts.markPaid(input.tenantId, input.venueId, check.checkId);

    return { payment, closure };
  }
}
