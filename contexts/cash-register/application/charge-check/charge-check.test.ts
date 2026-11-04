import { expect, it, vi } from "vitest";

import {
  ChargeCheck,
  ChargeLedger,
  DrawerAudit,
  type DrawerOpenedAudit,
  InvalidClosureId,
  type RecordedCharge,
  UnknownAccount,
} from "#application/charge-check/charge-check.js";
import {
  type AccountCheck,
  AccountGateway,
} from "#application/ports/account-gateway.js";
import {
  type CardCapture,
  CardTerminal,
} from "#application/ports/card-terminal.js";
import { Printer, type SaleReceiptJob } from "#application/ports/printer.js";
import {
  type KnownRegister,
  type RegisterDrawer,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { InvalidCashAmount } from "#domain/cash-shift.js";
import {
  ChangeExceedsCash,
  IncompleteCard,
  MissingTip,
  type PaymentTender,
} from "#domain/payment.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_5";
const LINE_ID = "orders_line_1";
const PRODUCT_ID = "menu_product_1";
const MENU_CLASS = "food";
const COMMAND_ID = "command_charge_1";
const PAYMENT_ID = "payment_mixed_1";
const CLOSURE_ID = "closure_mixed_1";
const TERMINAL = "terminal_front";
const BRAND = "visa";
const PORT_LAST_4 = "4242";
const TYPED_LAST_4 = "1111";
const PRINTER_ID = "printer-front";
const QUIET_PRINTER_ID = "printer-quiet";
const CASH_PAYMENT_ID = "payment_cash_1";
const CASH_CLOSURE_ID = "closure_cash_1";
const CASH_COMMAND_ID = "command_cash_1";

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

const accountKey = (
  tenantId: string,
  venueId: string,
  checkId: string,
): string => `${tenantId}:${venueId}:${checkId}`;

const chargeKey = (
  tenantId: string,
  venueId: string,
  commandId: string,
): string => `${tenantId}:${venueId}:${commandId}`;

const accountFor = (accountCop: number): AccountCheck => ({
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  accountCop,
  lines: [
    {
      lineId: LINE_ID,
      productId: PRODUCT_ID,
      priceCop: accountCop,
      originTableId: TABLE_ID,
      menuClass: MENU_CLASS,
    },
  ],
});

class MemoryAccounts extends AccountGateway {
  private readonly checks = new Map<string, AccountCheck>();

  constructor(tenantId: string, check: AccountCheck) {
    super();
    this.checks.set(accountKey(tenantId, VENUE_ID, check.checkId), check);
  }

  override async findCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountCheck | null> {
    return this.checks.get(accountKey(tenantId, venueId, checkId)) ?? null;
  }

  override async markPaid(
    _tenantId: string,
    _venueId: string,
    _checkId: string,
  ): Promise<void> {}
}

class MemoryCardTerminal extends CardTerminal {
  constructor(
    private readonly settle: (card: CardCapture) => CardCapture = (card) => ({
      ...card,
      last4: PORT_LAST_4,
    }),
  ) {
    super();
  }

  override async capture(card: CardCapture): Promise<CardCapture> {
    return this.settle(card);
  }
}

interface RegisterProfile {
  drawer: RegisterDrawer;
  printerId: string | null;
}

class MemoryPrinter extends Printer {
  readonly jobs: SaleReceiptJob[] = [];

  override async enqueue(job: SaleReceiptJob): Promise<{
    status: "waiting";
    kickDrawer: boolean;
  }> {
    this.jobs.push(job);

    return { status: "waiting", kickDrawer: job.kickDrawer };
  }
}

class MemoryDrawerAudit extends DrawerAudit {
  readonly events: DrawerOpenedAudit[] = [];

  override async record(event: DrawerOpenedAudit): Promise<void> {
    this.events.push(event);
  }
}

class MemoryRegisterLookup extends RegisterLookup {
  constructor(
    private readonly known: ReadonlySet<string>,
    private readonly profiles: ReadonlyMap<string, RegisterProfile> = new Map(),
  ) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null> {
    if (!this.known.has(registerKey(tenantId, venueId, registerId))) {
      return null;
    }

    const profile = this.profiles.get(
      registerKey(tenantId, venueId, registerId),
    );

    return {
      id: registerId,
      venueId,
      drawer: profile?.drawer ?? "absent",
      printerId: profile?.printerId ?? null,
    };
  }
}

class MemoryChargeLedger extends ChargeLedger {
  private readonly charges = new Map<string, RecordedCharge>();

  override async findByCommand(
    tenantId: string,
    venueId: string,
    commandId: string,
  ): Promise<RecordedCharge | null> {
    return this.charges.get(chargeKey(tenantId, venueId, commandId)) ?? null;
  }

  override async insert(
    tenantId: string,
    venueId: string,
    charge: RecordedCharge,
  ): Promise<void> {
    this.charges.set(chargeKey(tenantId, venueId, charge.commandId), charge);
  }
}

const knownRegisters = new Set([
  registerKey(TENANT_ID, VENUE_ID, REGISTER_ID),
  registerKey(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID),
]);

const chargeFor = (
  accountCop: number,
  terminal: CardTerminal = new MemoryCardTerminal(),
  clock?: { now(): number },
) => {
  const accounts = new MemoryAccounts(TENANT_ID, accountFor(accountCop));
  const ledger = new MemoryChargeLedger();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  const printer = new MemoryPrinter();
  const audits = new MemoryDrawerAudit();
  const charge = new ChargeCheck(
    lookup,
    accounts,
    terminal,
    ledger,
    printer,
    audits,
    clock,
  );

  return {
    accounts,
    ledger,
    terminal,
    printer,
    audits,
    charge,
  };
};

const cashInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  checkId: CHECK_ID,
  commandId: CASH_COMMAND_ID,
  paymentId: CASH_PAYMENT_ID,
  closureId: CASH_CLOSURE_ID,
  tenders: [{ method: "cash" as const, amountCop: 85_000 }],
  tip: { method: "cash" as const, amountCop: 0 },
};

const chargeCash = (profile: RegisterProfile) => {
  const accounts = new MemoryAccounts(TENANT_ID, accountFor(85_000));
  const ledger = new MemoryChargeLedger();
  const printer = new MemoryPrinter();
  const audits = new MemoryDrawerAudit();
  const lookup = new MemoryRegisterLookup(
    knownRegisters,
    new Map([[registerKey(TENANT_ID, VENUE_ID, REGISTER_ID), profile]]),
  );

  return {
    accounts,
    ledger,
    printer,
    audits,
    charge: new ChargeCheck(
      lookup,
      accounts,
      new MemoryCardTerminal(),
      ledger,
      printer,
      audits,
    ),
  };
};

const cardTender = (amountCop: number, approvalNumber: string) =>
  ({
    method: "card" as const,
    amountCop,
    terminal: TERMINAL,
    approvalNumber,
    brand: BRAND,
    last4: TYPED_LAST_4,
  }) as const;

const NON_CASH_METHODS = [
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
] as const;

const nonCashTender = (
  method: (typeof NON_CASH_METHODS)[number],
): PaymentTender => {
  if (method === "card") {
    return cardTender(85_000, "AP-85000");
  }

  return { method, amountCop: 85_000 };
};

const mixedInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  checkId: CHECK_ID,
  commandId: COMMAND_ID,
  paymentId: PAYMENT_ID,
  closureId: CLOSURE_ID,
  tenders: [
    cardTender(50_000, "AP-50000"),
    { method: "cash" as const, amountCop: 40_000 },
  ],
  tip: { method: "cash" as const, amountCop: 0 },
};

it("given an account of 85000, when card 50000 and cash 40000 are recorded, then one queued closure is stored and the account is marked paid after it", async () => {
  const { accounts, ledger, terminal, charge } = chargeFor(85_000);
  const order: string[] = [];
  const insertCharge = ledger.insert.bind(ledger);
  const markAccountPaid = accounts.markPaid.bind(accounts);
  vi.spyOn(ledger, "insert").mockImplementation(
    async (tenantId, venueId, recorded) => {
      order.push("closure");
      await insertCharge(tenantId, venueId, recorded);
    },
  );
  vi.spyOn(accounts, "markPaid").mockImplementation(
    async (tenantId, venueId, checkId) => {
      order.push("paid");
      await markAccountPaid(tenantId, venueId, checkId);
    },
  );
  const capture = vi.spyOn(terminal, "capture");

  const paid = await charge.execute(mixedInput);

  expect(paid.payment.id).toBe(PAYMENT_ID);
  expect(paid.payment.saleCop).toBe(85_000);
  expect(paid.payment.changeCop).toBe(5_000);
  expect(paid.payment.tip).toEqual({ method: "cash", amountCop: 0 });
  expect(paid.payment.tenders).toEqual([
    {
      method: "card",
      amountCop: 50_000,
      terminal: TERMINAL,
      approvalNumber: "AP-50000",
      brand: BRAND,
      last4: PORT_LAST_4,
    },
    { method: "cash", amountCop: 40_000 },
  ]);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith({
    terminal: TERMINAL,
    approvalNumber: "AP-50000",
    brand: BRAND,
    last4: TYPED_LAST_4,
  });
  expect(paid.closure).toEqual({
    id: CLOSURE_ID,
    status: "queued",
    commandId: COMMAND_ID,
    checkId: CHECK_ID,
    tableId: TABLE_ID,
    registerId: REGISTER_ID,
    paymentId: PAYMENT_ID,
    saleCop: 85_000,
    changeCop: 5_000,
    lines: [
      {
        lineId: LINE_ID,
        productId: PRODUCT_ID,
        priceCop: 85_000,
        originTableId: TABLE_ID,
        menuClass: MENU_CLASS,
      },
    ],
    tenders: paid.payment.tenders,
    tip: { method: "cash", amountCop: 0 },
  });
  expect(paid.closure.id.startsWith("closure_")).toBe(true);
  expect(order).toEqual(["closure", "paid"]);
  expect(accounts.markPaid).toHaveBeenCalledTimes(1);
  expect(accounts.markPaid).toHaveBeenCalledWith(TENANT_ID, VENUE_ID, CHECK_ID);
  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);
  expect(stored?.closure.status).toBe("queued");
  expect(stored?.closure.id).toBe(CLOSURE_ID);
});

it("given an account of 100000, when the customer adds a 10000 tip by card, then the sale stays 100000 and the card tip is 10000", async () => {
  const { terminal, charge } = chargeFor(100_000);
  const capture = vi.spyOn(terminal, "capture");

  const paid = await charge.execute({
    ...mixedInput,
    paymentId: "payment_tip_apart",
    closureId: "closure_tip_apart",
    commandId: "command_tip_apart",
    tenders: [{ method: "cash", amountCop: 100_000 }],
    tip: {
      method: "card",
      amountCop: 10_000,
      terminal: TERMINAL,
      approvalNumber: "AP-TIP",
      brand: BRAND,
      last4: TYPED_LAST_4,
    },
  });

  expect(paid.payment.saleCop).toBe(100_000);
  expect(paid.payment.changeCop).toBe(0);
  expect(paid.payment.tenders).toEqual([
    { method: "cash", amountCop: 100_000 },
  ]);
  expect(paid.payment.tip).toEqual({
    method: "card",
    amountCop: 10_000,
    terminal: TERMINAL,
    approvalNumber: "AP-TIP",
    brand: BRAND,
    last4: PORT_LAST_4,
  });
  expect(paid.closure.saleCop).toBe(100_000);
  expect(paid.closure.tip).toEqual(paid.payment.tip);
  expect(paid.closure.status).toBe("queued");
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith({
    terminal: TERMINAL,
    approvalNumber: "AP-TIP",
    brand: BRAND,
    last4: TYPED_LAST_4,
  });
});

it("given a full payment, when the same commandId is submitted again, then one closure remains and the account port is not called again", async () => {
  const { accounts, ledger, terminal, charge } = chargeFor(85_000);
  const findCheck = vi.spyOn(accounts, "findCheck");
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");
  const capture = vi.spyOn(terminal, "capture");

  const first = await charge.execute(mixedInput);
  const findCalls = findCheck.mock.calls.length;
  const paidCalls = markPaid.mock.calls.length;
  const insertCalls = insert.mock.calls.length;
  const captureCalls = capture.mock.calls.length;

  const second = await charge.execute({
    ...mixedInput,
    paymentId: "payment_mixed_2",
    closureId: "closure_mixed_2",
  });

  expect(second.closure).toEqual(first.closure);
  expect(second.payment.id).toBe(first.payment.id);
  expect(findCheck).toHaveBeenCalledTimes(findCalls);
  expect(markPaid).toHaveBeenCalledTimes(paidCalls);
  expect(insert).toHaveBeenCalledTimes(insertCalls);
  expect(capture).toHaveBeenCalledTimes(captureCalls);
  expect(markPaid).toHaveBeenCalledTimes(1);
  expect(insert).toHaveBeenCalledTimes(1);
  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);
  expect(stored?.closure.id).toBe(CLOSURE_ID);
});

it("given a card capture without an approval number, when the cashier submits it, then IncompleteCard and nothing is saved", async () => {
  const terminal = new MemoryCardTerminal((card) => ({
    ...card,
    approvalNumber: "",
  }));
  const { accounts, ledger, charge } = chargeFor(85_000, terminal);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");
  const capture = vi.spyOn(terminal, "capture");

  const submit = charge.execute(mixedInput);

  await expect(submit).rejects.toThrow(IncompleteCard);
  expect(capture).toHaveBeenCalledWith({
    terminal: TERMINAL,
    approvalNumber: "AP-50000",
    brand: BRAND,
    last4: TYPED_LAST_4,
  });
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);
  expect(stored).toBeNull();
});

it("given an account of 85000, when the cash change is larger than the cash tender, then ChangeExceedsCash and nothing is saved", async () => {
  const { accounts, ledger, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");

  const submit = charge.execute({
    ...mixedInput,
    paymentId: "payment_change_exceeds",
    closureId: "closure_change_exceeds",
    commandId: "command_change_exceeds",
    tenders: [
      cardTender(90_000, "AP-90000"),
      { method: "cash" as const, amountCop: 1_000 },
    ],
  });

  await expect(submit).rejects.toThrow(ChangeExceedsCash);
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  const stored = await ledger.findByCommand(
    TENANT_ID,
    VENUE_ID,
    "command_change_exceeds",
  );
  expect(stored).toBeNull();
});

it("given a payment with no tip decision, when the cashier submits it, then MissingTip and nothing is saved", async () => {
  const { accounts, ledger, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");

  const submit = charge.execute({
    ...mixedInput,
    paymentId: "payment_missing_tip",
    closureId: "closure_missing_tip",
    commandId: "command_missing_tip",
    tenders: [{ method: "cash", amountCop: 85_000 }],
    tip: undefined,
  });

  await expect(submit).rejects.toThrow(MissingTip);
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});

it("given an unknown register, when a check is charged, then UnknownRegister and nothing is saved", async () => {
  const { accounts, ledger, terminal, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const findCheck = vi.spyOn(accounts, "findCheck");
  const insert = vi.spyOn(ledger, "insert");
  const capture = vi.spyOn(terminal, "capture");

  const submit = charge.execute({
    ...mixedInput,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(submit).rejects.toThrow(UnknownRegister);
  expect(findCheck).not.toHaveBeenCalled();
  expect(capture).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);
  expect(stored).toBeNull();
});

it("given a closure id without the closure_ prefix, when the cashier charges, then nothing is saved", async () => {
  const { accounts, ledger, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");

  const submit = charge.execute({
    ...mixedInput,
    closureId: "sale_mixed_1",
  });

  await expect(submit).rejects.toThrow(InvalidClosureId);
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});

it("given a fractional peso, when the cashier charges, then nothing is saved", async () => {
  const { accounts, ledger, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");

  const submit = charge.execute({
    ...mixedInput,
    tenders: [{ method: "cash" as const, amountCop: 85_000.5 }],
    tip: { method: "cash", amountCop: 0 },
  });

  await expect(submit).rejects.toThrow(InvalidCashAmount);
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});

it("given an unknown account, when the cashier charges, then nothing is saved", async () => {
  const { accounts, ledger, charge } = chargeFor(85_000);
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");

  const submit = charge.execute({
    ...mixedInput,
    checkId: "orders_check_missing",
    commandId: "command_missing_check",
  });

  await expect(submit).rejects.toThrow(UnknownAccount);
  expect(insert).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
});

it("given a charge saved for one tenant, when another tenant loads that command, then the closure is absent", async () => {
  const { ledger, charge } = chargeFor(85_000);

  await charge.execute(mixedInput);

  const otherTenant = await ledger.findByCommand(
    OTHER_TENANT_ID,
    VENUE_ID,
    COMMAND_ID,
  );
  const sameTenant = await ledger.findByCommand(
    TENANT_ID,
    VENUE_ID,
    COMMAND_ID,
  );
  expect(otherTenant).toBeNull();
  expect(sameTenant?.closure.id).toBe(CLOSURE_ID);
  expect(sameTenant?.payment.saleCop).toBe(85_000);
});

it("given a present drawer and a cash sale, when the charge is saved, then that printer is kicked and cash.drawer-opened is audited once", async () => {
  const { accounts, ledger, printer, audits, charge } = chargeCash({
    drawer: "present",
    printerId: PRINTER_ID,
  });
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");
  const enqueue = vi.spyOn(printer, "enqueue");
  const record = vi.spyOn(audits, "record");

  await charge.execute(cashInput);
  await charge.execute({
    ...cashInput,
    paymentId: "payment_cash_again",
    closureId: "closure_cash_again",
  });

  expect(printer.jobs).toEqual([
    {
      commandId: CASH_COMMAND_ID,
      printerId: PRINTER_ID,
      document: "offline_receipt",
      kickDrawer: true,
    },
  ]);
  expect(audits.events).toEqual([
    {
      action: "cash.drawer-opened",
      paymentId: CASH_PAYMENT_ID,
      registerId: REGISTER_ID,
      printerId: PRINTER_ID,
    },
  ]);
  expect(record).toHaveBeenCalledTimes(1);
  expect(insert.mock.invocationCallOrder[0]).toBeLessThan(
    markPaid.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(markPaid.mock.invocationCallOrder[0]).toBeLessThan(
    enqueue.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(
    record.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
  expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
});

it("given an absent drawer and a cash sale, when the charge is saved, then the receipt prints with no kick, no drawer audit, and no open-without-sale", async () => {
  const { ledger, printer, audits, charge } = chargeCash({
    drawer: "absent",
    printerId: QUIET_PRINTER_ID,
  });
  const insert = vi.spyOn(ledger, "insert");
  const record = vi.spyOn(audits, "record");

  await charge.execute(cashInput);

  expect(printer.jobs).toEqual([
    {
      commandId: CASH_COMMAND_ID,
      printerId: QUIET_PRINTER_ID,
      document: "offline_receipt",
      kickDrawer: false,
    },
  ]);
  expect(audits.events).toEqual([]);
  expect(record).not.toHaveBeenCalled();
  expect(insert).toHaveBeenCalledTimes(1);
  expect(Object.getOwnPropertyNames(ChargeCheck.prototype)).toEqual([
    "constructor",
    "execute",
  ]);
  expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
  expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
  const stored = await ledger.findByCommand(
    TENANT_ID,
    VENUE_ID,
    CASH_COMMAND_ID,
  );
  expect(stored?.closure.id).toBe(CASH_CLOSURE_ID);
});

it.each(NON_CASH_METHODS)(
  "given a present drawer and a %s sale, when the charge is saved, then the drawer is not kicked and cash.drawer-opened is not audited",
  async (method) => {
    const { printer, audits, charge } = chargeCash({
      drawer: "present",
      printerId: PRINTER_ID,
    });

    await charge.execute({
      ...cashInput,
      commandId: `command_${method}`,
      paymentId: `payment_${method}`,
      closureId: `closure_${method}`,
      tenders: [nonCashTender(method)],
      tip: { method: "cash", amountCop: 0 },
    });

    expect(printer.jobs).toEqual([]);
    expect(audits.events).toEqual([]);
    expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
    expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
  },
);

it("given a present drawer and card plus transfer, when the charge has no cash, then the drawer is not kicked and nothing is audited", async () => {
  const { printer, audits, charge } = chargeCash({
    drawer: "present",
    printerId: PRINTER_ID,
  });

  await charge.execute({
    ...cashInput,
    commandId: "command_card_transfer",
    paymentId: "payment_card_transfer",
    closureId: "closure_card_transfer",
    tenders: [
      cardTender(50_000, "AP-50000"),
      { method: "transfer", amountCop: 35_000 },
    ],
    tip: { method: "cash", amountCop: 0 },
  });

  expect(printer.jobs).toEqual([]);
  expect(audits.events).toEqual([]);
});

it("given a present drawer and a card plus cash sale, when the charge is saved, then that printer is kicked and cash.drawer-opened is audited once", async () => {
  const { accounts, ledger, printer, audits, charge } = chargeCash({
    drawer: "present",
    printerId: PRINTER_ID,
  });
  const markPaid = vi.spyOn(accounts, "markPaid");
  const insert = vi.spyOn(ledger, "insert");
  const enqueue = vi.spyOn(printer, "enqueue");
  const record = vi.spyOn(audits, "record");

  await charge.execute(mixedInput);
  await charge.execute({
    ...mixedInput,
    paymentId: "payment_mixed_again",
    closureId: "closure_mixed_again",
  });

  expect(printer.jobs).toEqual([
    {
      commandId: COMMAND_ID,
      printerId: PRINTER_ID,
      document: "offline_receipt",
      kickDrawer: true,
    },
  ]);
  expect(audits.events).toEqual([
    {
      action: "cash.drawer-opened",
      paymentId: PAYMENT_ID,
      registerId: REGISTER_ID,
      printerId: PRINTER_ID,
    },
  ]);
  expect(record).toHaveBeenCalledTimes(1);
  expect(insert.mock.invocationCallOrder[0]).toBeLessThan(
    markPaid.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(markPaid.mock.invocationCallOrder[0]).toBeLessThan(
    enqueue.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(
    record.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
  );
  expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
  expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
});

it("given an absent drawer and a card plus cash sale, when the charge is saved, then the receipt prints with no kick and no drawer audit", async () => {
  const { ledger, printer, audits, charge } = chargeCash({
    drawer: "absent",
    printerId: QUIET_PRINTER_ID,
  });
  const record = vi.spyOn(audits, "record");

  await charge.execute(mixedInput);

  expect(printer.jobs).toEqual([
    {
      commandId: COMMAND_ID,
      printerId: QUIET_PRINTER_ID,
      document: "offline_receipt",
      kickDrawer: false,
    },
  ]);
  expect(audits.events).toEqual([]);
  expect(record).not.toHaveBeenCalled();
  expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
  expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);
  expect(stored?.closure.id).toBe(CLOSURE_ID);
});

it("given the platform clock, when a check is charged and the command repeats, then the stored payment time is that clock", async () => {
  const firstInstant = Date.parse("2026-11-04T18:21:00.000Z");
  let calls = 0;
  const clock = {
    now: () => {
      calls += 1;

      return firstInstant + (calls - 1) * 60_000;
    },
  };
  const { ledger, charge } = chargeFor(85_000, new MemoryCardTerminal(), clock);

  await charge.execute(mixedInput);
  await charge.execute({
    ...mixedInput,
    paymentId: "payment_mixed_again",
    closureId: "closure_mixed_again",
  });

  const stored = await ledger.findByCommand(TENANT_ID, VENUE_ID, COMMAND_ID);

  expect(stored?.recordedAt).toBe("2026-11-04T18:21:00.000Z");
  expect(stored?.payment).not.toHaveProperty("taxCop");
  expect(calls).toBe(1);
});
