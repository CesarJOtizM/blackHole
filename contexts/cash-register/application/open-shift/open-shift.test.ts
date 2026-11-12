import { expect, it, vi } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import type { QrIssueDocumentCommand } from "#application/apply-qr-payment/apply-qr-payment.js";
import {
  ApplyQrPayment,
  QrInvoiceIssuer,
} from "#application/apply-qr-payment/apply-qr-payment.js";
import { ConfirmQrPayment } from "#application/confirm-qr-payment/confirm-qr-payment.js";
import { OpenShift } from "#application/open-shift/open-shift.js";
import type { AccountCheck } from "#application/ports/account-gateway.js";
import { AccountGateway } from "#application/ports/account-gateway.js";
import { AccountSplitStore } from "#application/ports/account-split-store.js";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import { QrPaymentAvailability } from "#application/ports/qr-payment-availability.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { StartQrPayment } from "#application/start-qr-payment/start-qr-payment.js";
import {
  CashShift,
  InvalidShiftId,
  ShiftAlreadyOpen,
} from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CASHIER_ID = "user_cashier";
const OTHER_CASHIER_ID = "user_other";
const SHIFT_ID = "shift_front_1";
const OTHER_SHIFT_ID = "shift_front_2";
const OPENING_FLOAT_COP = 200_000;

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

class MemoryCashRegister extends CashRegisterRepository {
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

class MemoryRegisterLookup extends RegisterLookup {
  constructor(private readonly known: ReadonlySet<string>) {
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

    return { id: registerId, venueId, drawer: "absent", printerId: null };
  }
}

const knownRegisters = new Set([
  registerKey(TENANT_ID, VENUE_ID, REGISTER_ID),
  registerKey(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID),
]);

const openShiftFor = () => {
  const repository = new MemoryCashRegister();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  return {
    repository,
    openShift: new OpenShift(repository, lookup),
  };
};

const openInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  shiftId: SHIFT_ID,
  cashierId: CASHIER_ID,
  openingFloatCop: OPENING_FLOAT_COP,
};

it("given cash register C has no open shift, when cashier K declares a 200000 float, then a shift opens for K on C", async () => {
  const { repository, openShift } = openShiftFor();

  const opened = await openShift.execute(openInput);

  expect(opened.id).toBe(SHIFT_ID);
  expect(opened.registerId).toBe(REGISTER_ID);
  expect(opened.cashierId).toBe(CASHIER_ID);
  expect(opened.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(opened.state).toBe("open");
  expect(opened.expectedCashCop).toBe(OPENING_FLOAT_COP);
  expect(opened.movements).toEqual([]);
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.id).toBe(SHIFT_ID);
  expect(stored?.cashierId).toBe(CASHIER_ID);
  expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(stored?.state).toBe("open");
});

it("given C has an open shift, when another cashier opens a shift on C, then ShiftAlreadyOpen and the first shift stays", async () => {
  const { repository, openShift } = openShiftFor();
  await openShift.execute(openInput);
  const save = vi.spyOn(repository, "save");

  const openAgain = openShift.execute({
    ...openInput,
    shiftId: OTHER_SHIFT_ID,
    cashierId: OTHER_CASHIER_ID,
    openingFloatCop: 50_000,
  });

  await expect(openAgain).rejects.toThrow(ShiftAlreadyOpen);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.id).toBe(SHIFT_ID);
  expect(stored?.cashierId).toBe(CASHIER_ID);
  expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(stored?.state).toBe("open");
});

it("given a rejection, when a shift is opened, then it stays unsaved", async () => {
  const { repository, openShift } = openShiftFor();
  const save = vi.spyOn(repository, "save");

  const open = openShift.execute({
    ...openInput,
    shiftId: "front_1",
  });

  await expect(open).rejects.toThrow(InvalidShiftId);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored).toBeNull();
});

it("given an unknown register, when a shift is opened, then UnknownRegister and nothing is saved", async () => {
  const { repository, openShift } = openShiftFor();
  const save = vi.spyOn(repository, "save");

  const open = openShift.execute({
    ...openInput,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(open).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(
    TENANT_ID,
    VENUE_ID,
    UNKNOWN_REGISTER_ID,
  );
  expect(stored).toBeNull();
});

it("given a shift saved for one tenant, when another tenant loads that register, then the shift is absent", async () => {
  const { repository, openShift } = openShiftFor();

  await openShift.execute(openInput);

  const otherTenant = await repository.load(
    OTHER_TENANT_ID,
    VENUE_ID,
    REGISTER_ID,
  );
  const sameTenant = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(otherTenant).toBeNull();
  expect(sameTenant?.id).toBe(SHIFT_ID);
});

class QuietInvoices extends QrInvoiceIssuer {
  override async execute(
    _command: QrIssueDocumentCommand,
  ): Promise<{ document: { status: string } }> {
    return { document: { status: "accepted" } };
  }
}

class PendingAccounts extends AccountGateway {
  override async findCheck(): Promise<AccountCheck> {
    return {
      checkId: "orders_check_1",
      tableId: "orders_table_2",
      accountCop: 120_000,
      lines: [],
    };
  }

  override async markPaid(): Promise<void> {}
}

class EmptySplits extends AccountSplitStore {
  override async find(): Promise<null> {
    return null;
  }

  override async save(): Promise<void> {}
}

class EnabledQr extends QrPaymentAvailability {
  override async enabled(): Promise<boolean> {
    return true;
  }
}

it("given a pending qr payment, when the next shift opens, then it is applied once and a closed shift stays unchanged", async () => {
  const repository = new MemoryCashRegister();
  const lookup = new MemoryRegisterLookup(knownRegisters);
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const start = new StartQrPayment(
    new PendingAccounts(),
    new EmptySplits(),
    payments,
    gateway,
    new EnabledQr(),
    () => "qrpay_pending",
    { now: () => 1_700_000_000_000 },
  );
  const confirm = new ConfirmQrPayment(payments, gateway);
  const apply = new ApplyQrPayment(
    payments,
    repository,
    new QuietInvoices(),
    new PendingAccounts(),
  );
  const started = await start.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: "orders_check_1",
    tipCop: 0,
    amountCop: 10_000,
  });
  gateway.verified = {
    reference: started.payment.reference,
    amountCop: 120_000,
    instrument: "card",
  };
  await confirm.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    rawBody: "{}",
    signature: "signed",
  });
  const pending = await apply.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    reference: started.payment.reference,
  });
  const closed = CashShift.forRegister("organization_register_bar");
  closed.open({
    id: "shift_bar_1",
    cashierId: CASHIER_ID,
    openingFloatCop: 50_000,
  });
  const closedBefore = {
    payments: closed.payments.map((payment) => ({ ...payment })),
    expectedCashCop: closed.expectedCashCop,
  };
  const openShift = new OpenShift(repository, lookup, apply);

  const opened = await openShift.execute(openInput);

  expect(pending.status).toBe("pending_application");
  expect(closed.payments.map((payment) => ({ ...payment }))).toEqual(
    closedBefore.payments,
  );
  expect(closed.expectedCashCop).toBe(closedBefore.expectedCashCop);
  expect(opened.payments).toEqual([
    {
      id: "payment_qrpay_pending",
      originalPaymentId: "payment_qrpay_pending",
      method: "qr",
      amountCop: 120_000,
    },
  ]);
  expect(opened.expectedCashCop).toBe(OPENING_FLOAT_COP);
  await expect(
    openShift.execute({
      ...openInput,
      shiftId: OTHER_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
    }),
  ).rejects.toThrow(ShiftAlreadyOpen);
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.payments).toHaveLength(1);
  expect(
    await payments.listByStatus(TENANT_ID, VENUE_ID, "applied"),
  ).toHaveLength(1);
  expect(
    await payments.listByStatus(TENANT_ID, VENUE_ID, "pending_application"),
  ).toEqual([]);
});
