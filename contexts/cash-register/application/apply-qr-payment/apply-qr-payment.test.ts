import { expect, it } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import type { QrIssueDocumentCommand } from "#application/apply-qr-payment/apply-qr-payment.js";
import {
  ApplyQrPayment,
  QrInvoiceIssuer,
} from "#application/apply-qr-payment/apply-qr-payment.js";
import { ConfirmQrPayment } from "#application/confirm-qr-payment/confirm-qr-payment.js";
import {
  type AccountCheck,
  AccountGateway,
} from "#application/ports/account-gateway.js";
import { AccountSplitStore } from "#application/ports/account-split-store.js";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import { QrPaymentAvailability } from "#application/ports/qr-payment-availability.js";
import {
  type KnownRegister,
  RegisterLookup,
} from "#application/ports/register-lookup.js";
import { SplitAccount } from "#application/split-account/split-account.js";
import { StartQrPayment } from "#application/start-qr-payment/start-qr-payment.js";
import { AccountSplit } from "#domain/account-split.js";
import { CashShift } from "#domain/cash-shift.js";
import type { QrInstrument } from "#domain/qr-payment.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_2";
const CASHIER_ID = "user_cashier";
const SHIFT_ID = "shift_front_1";
const OPENING_FLOAT_COP = 200_000;
const BALANCE_COP = 85_000;
const TIP_COP = 8_500;
const CHARGE_COP = 93_500;

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

class MemoryAccounts extends AccountGateway {
  override async findCheck(): Promise<AccountCheck | null> {
    return {
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      accountCop: BALANCE_COP,
      lines: [],
    };
  }

  override async markPaid(): Promise<void> {}
}

class MemorySplits extends AccountSplitStore {
  override async find(): Promise<null> {
    return null;
  }

  override async save(): Promise<void> {}
}

class OpenAvailability extends QrPaymentAvailability {
  override async enabled(): Promise<boolean> {
    return true;
  }
}

class MemoryRegisters extends CashRegisterRepository {
  private readonly shifts = new Map<string, CashShift>();

  override async load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null> {
    return this.shifts.get(registerKey(tenantId, venueId, registerId)) ?? null;
  }

  override async save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void> {
    this.shifts.set(registerKey(tenantId, venueId, shift.registerId), shift);
  }
}

class RecordingInvoices extends QrInvoiceIssuer {
  readonly commands: QrIssueDocumentCommand[] = [];

  fail = false;

  override async execute(
    command: QrIssueDocumentCommand,
  ): Promise<{ document: { status: string } }> {
    this.commands.push(command);

    if (this.fail) {
      throw new Error("provider down");
    }

    return { document: { status: "accepted" } };
  }
}

const applyFor = async () => {
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const registers = new MemoryRegisters();
  const invoices = new RecordingInvoices();
  const references = [
    "qrpay_card",
    "qrpay_nequi",
    "qrpay_daviplata",
    "qrpay_breb",
    "qrpay_down",
  ];
  const start = new StartQrPayment(
    new MemoryAccounts(),
    new MemorySplits(),
    payments,
    gateway,
    new OpenAvailability(),
    () => references.shift() ?? "qrpay_extra",
    { now: () => 1_700_000_000_000 },
  );
  const confirm = new ConfirmQrPayment(payments, gateway);
  const apply = new ApplyQrPayment(payments, registers, invoices);
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });
  await registers.save(TENANT_ID, VENUE_ID, shift);

  const confirmInstrument = async (instrument: QrInstrument) => {
    const started = await start.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tipCop: TIP_COP,
      amountCop: 10_000,
    });
    gateway.verified = {
      reference: started.payment.reference,
      amountCop: CHARGE_COP,
      instrument,
    };
    await confirm.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      rawBody: "{}",
      signature: "signed",
    });

    return started.payment.reference;
  };

  return { registers, invoices, apply, confirmInstrument, shift };
};

const applyInput = (reference: string) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  reference,
  taxpayerEmail: "guest@example.com",
  siteRangeId: "site_range_qr",
});

it("given a confirmed card payment with a tip, when it is applied, then the tender is qr, the invoice is card, and tipCop stays apart", async () => {
  const { registers, invoices, apply, confirmInstrument, shift } =
    await applyFor();
  const reference = await confirmInstrument("card");

  const applied = await apply.execute(applyInput(reference));
  const again = await apply.execute(applyInput(reference));

  expect(applied.tenderMethod).toBe("qr");
  expect(applied.tipCop).toBe(TIP_COP);
  expect(applied.invoiceMethod).toBe("card");
  expect(applied.issuanceStatus).toBe("accepted");
  expect(applied.saleCop).toBe(BALANCE_COP);
  expect(again).toEqual(applied);
  expect(shift.expectedCashCop).toBe(OPENING_FLOAT_COP);
  expect(shift.payments).toEqual([
    {
      id: `payment_${reference}`,
      originalPaymentId: `payment_${reference}`,
      method: "qr",
      amountCop: BALANCE_COP,
    },
  ]);
  expect(invoices.commands).toEqual([
    {
      closureId: `closure_${reference}`,
      referenceCode: reference,
      taxpayerEmail: "guest@example.com",
      documentBalance: BALANCE_COP,
      rules: [],
      siteRangeId: "site_range_qr",
      registerRangeId: REGISTER_ID,
    },
  ]);
  const stored = await registers.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.payments).toHaveLength(1);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT_COP);
});

it.each(["nequi", "daviplata", "bre-b"] as const)(
  "given a confirmed %s payment, when it is applied, then the invoice method is transfer and the tender stays qr",
  async (instrument) => {
    const { invoices, apply, confirmInstrument } = await applyFor();
    const reference = await confirmInstrument(instrument);

    const applied = await apply.execute(applyInput(reference));

    expect(applied.tenderMethod).toBe("qr");
    expect(applied.invoiceMethod).toBe("transfer");
    expect(applied.tipCop).toBe(TIP_COP);
    expect(invoices.commands).toHaveLength(1);
  },
);

it("given the invoice provider is down, when a confirmed payment is applied, then issuance stays pending_issuance", async () => {
  const { invoices, apply, confirmInstrument, shift } = await applyFor();
  invoices.fail = true;
  const reference = await confirmInstrument("card");

  const applied = await apply.execute(applyInput(reference));

  expect(applied.tenderMethod).toBe("qr");
  expect(applied.tipCop).toBe(TIP_COP);
  expect(applied.issuanceStatus).toBe("pending_issuance");
  expect(shift.payments).toHaveLength(1);
  expect(shift.expectedCashCop).toBe(OPENING_FLOAT_COP);
  expect(invoices.commands).toHaveLength(1);
});

const PART_1_ID = "part_1";
const PART_2_ID = "part_2";
const PART_1_COP = 40_000;
const PART_2_COP = 45_000;
const ADDED_LINE_COP = 10_000;

class TableAccounts extends AccountGateway {
  accountCop = BALANCE_COP;

  tableState: "occupied" | "to_clean" = "occupied";

  paidCalls = 0;

  override async findCheck(): Promise<AccountCheck> {
    return {
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      accountCop: this.accountCop,
      lines: [],
    };
  }

  override async markPaid(): Promise<void> {
    this.paidCalls += 1;
    this.tableState = "to_clean";
  }
}

class MemoryRegisterLookup extends RegisterLookup {
  override async find(
    _tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null> {
    if (registerId !== REGISTER_ID) {
      return null;
    }

    return { id: registerId, venueId, drawer: "absent", printerId: null };
  }
}

class SavingSplits extends AccountSplitStore {
  private split: AccountSplit | null = null;

  override async find(
    _tenantId: string,
    _venueId: string,
    _checkId: string,
  ): Promise<AccountSplit | null> {
    return this.split;
  }

  override async save(
    _tenantId: string,
    _venueId: string,
    _checkId: string,
    split: AccountSplit,
  ): Promise<void> {
    this.split = split;
  }
}

const releaseFor = async () => {
  const accounts = new TableAccounts();
  const splits = new SavingSplits();
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const registers = new MemoryRegisters();
  const invoices = new RecordingInvoices();
  const references = ["qrpay_part", "qrpay_rest", "qrpay_full", "qrpay_later"];
  const start = new StartQrPayment(
    accounts,
    splits,
    payments,
    gateway,
    new OpenAvailability(),
    () => references.shift() ?? "qrpay_extra",
    { now: () => 1_700_000_000_000 },
  );
  const confirm = new ConfirmQrPayment(payments, gateway);
  const splitAccount = new SplitAccount(
    new MemoryRegisterLookup(),
    accounts,
    splits,
  );
  const apply = new ApplyQrPayment(
    payments,
    registers,
    invoices,
    accounts,
    splitAccount,
  );
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });
  await registers.save(TENANT_ID, VENUE_ID, shift);
  await splits.save(
    TENANT_ID,
    VENUE_ID,
    CHECK_ID,
    AccountSplit.create({
      accountCop: BALANCE_COP,
      parts: [
        { id: PART_1_ID, amountCop: PART_1_COP, originTableId: TABLE_ID },
        { id: PART_2_ID, amountCop: PART_2_COP, originTableId: TABLE_ID },
      ],
    }),
  );

  const confirmPart = async (partId: string | undefined, tipCop: number) => {
    const started = await start.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tipCop,
      partId,
      amountCop: 10_000,
    });
    gateway.verified = {
      reference: started.payment.reference,
      amountCop: started.payment.amountCop,
      instrument: "card",
    };
    await confirm.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      rawBody: "{}",
      signature: "signed",
    });

    return started.payment;
  };

  return { accounts, splits, apply, confirmPart, shift };
};

it("given a split account, when one part is paid by qr, then the table stays occupied", async () => {
  const { accounts, splits, apply, confirmPart } = await releaseFor();
  const payment = await confirmPart(PART_1_ID, 0);

  const applied = await apply.execute(applyInput(payment.reference));
  const stored = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);

  expect(applied.saleCop).toBe(PART_1_COP);
  expect(applied.tenderMethod).toBe("qr");
  expect(stored?.parts.find((part) => part.id === PART_1_ID)?.paid).toBe(true);
  expect(stored?.parts.find((part) => part.id === PART_2_ID)?.paid).toBe(false);
  expect(stored?.open).toBe(true);
  expect(accounts.paidCalls).toBe(0);
  expect(accounts.tableState).toBe("occupied");
});

it("given the sale balance is zero, when the qr payment is applied, then markPaid frees the table", async () => {
  const { accounts, apply, confirmPart } = await releaseFor();
  const payment = await confirmPart(undefined, TIP_COP);

  const applied = await apply.execute(applyInput(payment.reference));

  expect(applied.saleCop).toBe(BALANCE_COP);
  expect(applied.tipCop).toBe(TIP_COP);
  expect(accounts.paidCalls).toBe(1);
  expect(accounts.tableState).toBe("to_clean");
});

it("given a line added after the charge started, when the payment is applied, then the snapshot is kept and the table stays occupied", async () => {
  const { accounts, apply, confirmPart, shift } = await releaseFor();
  const payment = await confirmPart(undefined, TIP_COP);
  accounts.accountCop = BALANCE_COP + ADDED_LINE_COP;

  const applied = await apply.execute(applyInput(payment.reference));

  expect(applied.saleCop).toBe(BALANCE_COP);
  expect(applied.tipCop).toBe(TIP_COP);
  expect(shift.payments[0]?.amountCop).toBe(BALANCE_COP);
  expect(accounts.accountCop).toBe(BALANCE_COP + ADDED_LINE_COP);
  expect(accounts.paidCalls).toBe(0);
  expect(accounts.tableState).toBe("occupied");
});
