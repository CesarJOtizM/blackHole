import { expect, it } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import {
  type AccountCheck,
  AccountGateway,
} from "#application/ports/account-gateway.js";
import { AccountSplitStore } from "#application/ports/account-split-store.js";
import { QrPaymentAvailability } from "#application/ports/qr-payment-availability.js";
import {
  QrPaymentDisabled,
  StartQrPayment,
} from "#application/start-qr-payment/start-qr-payment.js";
import { AccountSplit } from "#domain/account-split.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_2";
const BALANCE_COP = 85_000;
const TIP_COP = 8_500;
const CHARGE_COP = 93_500;
const TAMPERED_COP = 10_000;
const PART_1_ID = "part_1";
const PART_2_ID = "part_2";
const PART_1_COP = 40_000;
const PART_2_COP = 45_000;
const STARTED_AT = 1_700_000_000_000;

const accountKey = (
  tenantId: string,
  venueId: string,
  checkId: string,
): string => `${tenantId}:${venueId}:${checkId}`;

const accountFor = (accountCop: number): AccountCheck => ({
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  accountCop,
  lines: [
    {
      lineId: "orders_line_1",
      productId: "menu_product_1",
      priceCop: accountCop,
      originTableId: TABLE_ID,
      menuClass: "food",
    },
  ],
});

class MemoryAccounts extends AccountGateway {
  private readonly checks = new Map<string, AccountCheck>();

  constructor(check: AccountCheck) {
    super();
    this.checks.set(accountKey(TENANT_ID, VENUE_ID, check.checkId), check);
  }

  override async findCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountCheck | null> {
    return this.checks.get(accountKey(tenantId, venueId, checkId)) ?? null;
  }

  override async markPaid(): Promise<void> {}
}

class MemorySplits extends AccountSplitStore {
  private readonly splits = new Map<string, AccountSplit>();

  override async find(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountSplit | null> {
    return this.splits.get(accountKey(tenantId, venueId, checkId)) ?? null;
  }

  override async save(
    tenantId: string,
    venueId: string,
    checkId: string,
    split: AccountSplit,
  ): Promise<void> {
    this.splits.set(accountKey(tenantId, venueId, checkId), split);
  }
}

class MemoryAvailability extends QrPaymentAvailability {
  enabledValue = true;

  override async enabled(): Promise<boolean> {
    return this.enabledValue;
  }
}

const startFor = async (parted = false) => {
  const accounts = new MemoryAccounts(accountFor(BALANCE_COP));
  const splits = new MemorySplits();
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const availability = new MemoryAvailability();
  const references = [
    "qrpay_first",
    "qrpay_replaced",
    "qrpay_part_1",
    "qrpay_part_2",
  ];
  const start = new StartQrPayment(
    accounts,
    splits,
    payments,
    gateway,
    availability,
    () => references.shift() ?? "qrpay_extra",
    { now: () => STARTED_AT },
  );

  if (parted) {
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
  }

  return { payments, gateway, availability, start };
};

const payInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  tipCop: TIP_COP,
  amountCop: TAMPERED_COP,
};

it("given a balance of 85000 and a tip of 8500, when the customer pays a tampered amount, then the gateway is asked for 93500 with a qrpay_ reference", async () => {
  const { gateway, start } = await startFor();

  const started = await start.execute(payInput);

  expect(started.payment.balanceCop).toBe(BALANCE_COP);
  expect(started.payment.tipCop).toBe(TIP_COP);
  expect(started.payment.amountCop).toBe(CHARGE_COP);
  expect(started.payment.reference.startsWith("qrpay_")).toBe(true);
  expect(started.payment.status).toBe("started");
  expect(gateway.charges).toEqual([
    { reference: started.payment.reference, amountCop: CHARGE_COP },
  ]);
  expect(started.redirectUrl).toBe(
    `https://pay.test/${started.payment.reference}`,
  );
});

it("given a started charge, when the customer starts again with another tip, then one started charge remains and the old reference is gone", async () => {
  const { payments, gateway, start } = await startFor();
  const first = await start.execute(payInput);

  const replaced = await start.execute({
    ...payInput,
    tipCop: 0,
    amountCop: TAMPERED_COP,
  });
  const started = await payments.listStarted(TENANT_ID, VENUE_ID);

  expect(started).toHaveLength(1);
  expect(started[0]?.reference).toBe(replaced.payment.reference);
  expect(started[0]?.tipCop).toBe(0);
  expect(started[0]?.amountCop).toBe(BALANCE_COP);
  expect(started[0]?.reference).not.toBe(first.payment.reference);
  expect(
    await payments.findByReference(
      TENANT_ID,
      VENUE_ID,
      first.payment.reference,
    ),
  ).toBeNull();
  expect(gateway.charges.map((charge) => charge.amountCop)).toEqual([
    CHARGE_COP,
    BALANCE_COP,
  ]);
});

it("given an account split into two parts, when each part starts a charge, then each part keeps one started charge", async () => {
  const { payments, gateway, start } = await startFor(true);

  await start.execute({
    ...payInput,
    partId: PART_1_ID,
    tipCop: 5_000,
  });
  await start.execute({
    ...payInput,
    partId: PART_2_ID,
    tipCop: 0,
  });
  const started = await payments.listStarted(TENANT_ID, VENUE_ID);

  expect(started).toHaveLength(2);
  expect(started.map((payment) => payment.amountCop).toSorted()).toEqual([
    PART_2_COP,
    PART_1_COP + 5_000,
  ]);
  expect(gateway.charges.map((charge) => charge.amountCop).toSorted()).toEqual([
    PART_2_COP,
    PART_1_COP + 5_000,
  ]);
  expect(
    gateway.charges.every((charge) => charge.amountCop !== TAMPERED_COP),
  ).toBe(true);
});

it("given qr payment is disabled, when the customer pays, then the charge is refused and the gateway is not asked", async () => {
  const { gateway, availability, payments, start } = await startFor();
  availability.enabledValue = false;

  const pay = start.execute(payInput);

  await expect(pay).rejects.toThrow(QrPaymentDisabled);
  expect(gateway.charges).toEqual([]);
  expect(await payments.listStarted(TENANT_ID, VENUE_ID)).toEqual([]);
});
