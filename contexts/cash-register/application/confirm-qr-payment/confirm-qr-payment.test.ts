import { expect, it } from "vitest";
import { InMemoryQrPaymentRepository } from "#adapters/memory/in-memory-qr-payment-repository.js";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import { ConfirmQrPayment } from "#application/confirm-qr-payment/confirm-qr-payment.js";
import {
  type AccountCheck,
  AccountGateway,
} from "#application/ports/account-gateway.js";
import { AccountSplitStore } from "#application/ports/account-split-store.js";
import { QrPaymentAvailability } from "#application/ports/qr-payment-availability.js";
import { StartQrPayment } from "#application/start-qr-payment/start-qr-payment.js";
import { QrPaymentConfirmed } from "#domain/qr-payment.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_2";
const BALANCE_COP = 85_000;
const TIP_COP = 8_500;
const CHARGE_COP = 93_500;
const RAW_BODY = '{"reference":"qrpay_first"}';
const SIGNATURE = "signed";

const accountFor = (): AccountCheck => ({
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  accountCop: BALANCE_COP,
  lines: [],
});

class MemoryAccounts extends AccountGateway {
  override async findCheck(): Promise<AccountCheck | null> {
    return accountFor();
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

const confirmFor = () => {
  const payments = new InMemoryQrPaymentRepository();
  const gateway = new ScriptedPaymentGateway();
  const references = ["qrpay_first", "qrpay_replaced"];
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

  return { payments, gateway, start, confirm };
};

const payInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  tipCop: TIP_COP,
  amountCop: 10_000,
};

const webhook = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  rawBody: RAW_BODY,
  signature: SIGNATURE,
};

it("given a started charge, when the gateway confirms it twice, then one row keeps the same reference", async () => {
  const { payments, gateway, start, confirm } = confirmFor();
  const started = await start.execute(payInput);
  gateway.verified = {
    reference: started.payment.reference,
    amountCop: CHARGE_COP,
    instrument: "card",
  };

  const first = await confirm.execute(webhook);
  const second = await confirm.execute(webhook);
  const rows = await payments.listByStatus(TENANT_ID, VENUE_ID, "confirmed");

  expect(first).toBeInstanceOf(QrPaymentConfirmed);
  expect(second).toBe(first);
  expect(first?.reference).toBe(started.payment.reference);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.reference).toBe(started.payment.reference);
  expect(await payments.listStarted(TENANT_ID, VENUE_ID)).toEqual([]);
});

it("given a forged signature, when the webhook is received, then it is rejected and no payment exists", async () => {
  const { payments, gateway, start, confirm } = confirmFor();
  await start.execute(payInput);
  gateway.verified = null;

  const confirmed = await confirm.execute({
    ...webhook,
    signature: "forged",
  });

  expect(confirmed).toBeNull();
  expect(await payments.listByStatus(TENANT_ID, VENUE_ID, "confirmed")).toEqual(
    [],
  );
  expect(await payments.listStarted(TENANT_ID, VENUE_ID)).toHaveLength(1);
});

it("given a replaced charge, when the old reference is confirmed, then nothing is confirmed", async () => {
  const { payments, gateway, start, confirm } = confirmFor();
  const first = await start.execute(payInput);
  await start.execute({ ...payInput, tipCop: 0 });
  gateway.verified = {
    reference: first.payment.reference,
    amountCop: CHARGE_COP,
    instrument: "card",
  };

  const confirmed = await confirm.execute(webhook);

  expect(confirmed).toBeNull();
  expect(await payments.listByStatus(TENANT_ID, VENUE_ID, "confirmed")).toEqual(
    [],
  );
  expect(
    await payments.findByReference(
      TENANT_ID,
      VENUE_ID,
      first.payment.reference,
    ),
  ).toBeNull();
});
