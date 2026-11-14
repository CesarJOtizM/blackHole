import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  type TransferInMovement,
  type TransferReceiptWrite,
  TransferRepository,
} from "#application/ports/transfer-repository.js";
import {
  DestinationStock,
  ReceiveTransfer,
  UnauthorizedTransferDifference,
} from "#application/receive-transfer/receive-transfer.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";
import {
  TRANSFER_STATUS,
  Transfer,
  TransferNotInTransit,
} from "#domain/transfer.js";

const TENANT_ID = "organization_tenant";
const SITE_A = "venue_site_a";
const CENTRAL_ID = "location_central";
const POINT_ID = "location_point";
const TRANSFER_ID = "transfer_beef";
const BEEF_ID = "ingredient_beef";
const ACTOR_ID = "user_keeper";
const AUTHORIZER_ID = "user_supervisor";
const DEVICE_ID = "device_keeper";
const DISPATCHED_AT = "2026-11-13T18:00:00.000Z";
const RECEIVED_AT = "2026-11-13T19:00:00.000Z";
const ORIGIN_COST = 12;
const DESTINATION_COST = 10;

class MemoryTransferRepository extends TransferRepository {
  readonly records: Array<{ tenantId: string; transfer: Transfer }> = [];
  readonly movements: TransferInMovement[] = [];
  readonly outbox: readonly never[] = [];
  saves = 0;
  transactions = 0;
  private readonly averages = new Map<string, number>();

  save(tenantId: string, transfer: Transfer): Promise<void> {
    this.saves += 1;
    const index = this.records.findIndex(
      (record) =>
        record.tenantId === tenantId && record.transfer.id === transfer.id,
    );
    const record = { tenantId, transfer };

    if (index >= 0) {
      this.records[index] = record;
    } else {
      this.records.push(record);
    }

    return Promise.resolve();
  }

  find(tenantId: string, transferId: string): Promise<Transfer | null> {
    return Promise.resolve(
      this.records.find(
        (record) =>
          record.tenantId === tenantId && record.transfer.id === transferId,
      )?.transfer ?? null,
    );
  }

  override receive(
    tenantId: string,
    receipt: TransferReceiptWrite,
  ): Promise<void> {
    this.transactions += 1;
    const index = this.records.findIndex(
      (record) =>
        record.tenantId === tenantId &&
        record.transfer.id === receipt.transfer.id,
    );
    const record = { tenantId, transfer: receipt.transfer };

    if (index >= 0) {
      this.records[index] = record;
    } else {
      this.records.push(record);
    }

    this.movements.push(...receipt.movements);

    for (const average of receipt.averages) {
      this.averages.set(
        stockKey(tenantId, average.locationId, average.ingredientId),
        average.averageCost,
      );
    }

    return Promise.resolve();
  }

  averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): number {
    return this.averages.get(stockKey(tenantId, locationId, ingredientId)) ?? 0;
  }
}

class MemoryDestinationStock extends DestinationStock {
  private readonly balances = new Map<
    string,
    { onHand: number; averageCost: number }
  >();

  put(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    onHand: number,
    averageCost: number,
  ): void {
    this.balances.set(stockKey(tenantId, locationId, ingredientId), {
      onHand,
      averageCost,
    });
  }

  read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ onHand: number; averageCost: number } | null> {
    return Promise.resolve(
      this.balances.get(stockKey(tenantId, locationId, ingredientId)) ?? null,
    );
  }

  averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): number {
    return (
      this.balances.get(stockKey(tenantId, locationId, ingredientId))
        ?.averageCost ?? 0
    );
  }
}

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const stockKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const harness = () => {
  const transfers = new MemoryTransferRepository();
  const stock = new MemoryDestinationStock();
  const audit = new CapturedAudit();
  const receive = new ReceiveTransfer(transfers, stock, audit);

  return { transfers, stock, audit, receive };
};

const request = (quantity: number) =>
  Transfer.request({
    id: TRANSFER_ID,
    originLocationId: CENTRAL_ID,
    destinationLocationId: POINT_ID,
    lines: [{ ingredientId: BEEF_ID, quantity }],
  });

const dispatch = async (
  transfers: MemoryTransferRepository,
  quantity: number,
) => {
  const transfer = request(quantity);
  transfer.dispatch({
    actorId: ACTOR_ID,
    occurredAt: DISPATCHED_AT,
    origin: [
      { ingredientId: BEEF_ID, onHand: quantity, averageCost: ORIGIN_COST },
    ],
  });
  await transfers.save(TENANT_ID, transfer);
  return transfer;
};

const receipt = (receivedQuantity: number, authorizerId: string | null) => ({
  tenantId: TENANT_ID,
  transferId: TRANSFER_ID,
  actorId: ACTOR_ID,
  deviceId: DEVICE_ID,
  occurredAt: RECEIVED_AT,
  destinationVenueId: SITE_A,
  authorizerId,
  lines: [{ ingredientId: BEEF_ID, receivedQuantity }],
});

it("given a requested transfer, when receipt is attempted, then it is rejected and nothing is stored", async () => {
  const { transfers, stock, audit, receive } = harness();
  const transfer = request(10);
  await transfers.save(TENANT_ID, transfer);
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, grams(1000), DESTINATION_COST);
  const saves = transfers.saves;

  const pending = receive.execute(receipt(10, null));

  await expect(pending).rejects.toBeInstanceOf(TransferNotInTransit);
  expect(transfers.saves).toBe(saves);
  expect(transfers.transactions).toBe(0);
  expect(transfers.movements).toEqual([]);
  expect(transfers.outbox).toEqual([]);
  expect(transfer.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(transfer.receivedAt).toBeUndefined();
  expect(transfer.receivedBy).toBeUndefined();
  expect(transfer.lines[0]?.receivedQuantity).toBeUndefined();
  expect(transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(0);
  expect(stock.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    DESTINATION_COST,
  );
  expect(audit.commands).toEqual([]);
});

it("given a transfer was already received, when the same receipt is repeated, then the second call stores nothing", async () => {
  const quantity = grams(1000);
  const { transfers, stock, audit, receive } = harness();
  await dispatch(transfers, quantity);
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, quantity, DESTINATION_COST);
  const input = receipt(quantity, null);

  const first = await receive.execute(input);
  const transactions = transfers.transactions;
  const storedMovements = [...transfers.movements];
  const audits = [...audit.commands];

  const second = await receive.execute(input);

  expect(second).toBe(first);
  expect(second.status).toBe(TRANSFER_STATUS.RECEIVED);
  expect(transfers.transactions).toBe(transactions);
  expect(transfers.movements).toEqual(storedMovements);
  expect(transfers.outbox).toEqual([]);
  expect(audit.commands).toEqual(audits);
  expect(transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(11);
});

it("given 10 are in transit, when 9 are received without an authorizer, then nothing is stored", async () => {
  const { transfers, stock, audit, receive } = harness();
  const transfer = await dispatch(transfers, 10);
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, grams(1000), DESTINATION_COST);
  const saves = transfers.saves;

  const pending = receive.execute(receipt(9, null));

  await expect(pending).rejects.toBeInstanceOf(UnauthorizedTransferDifference);
  expect(transfers.saves).toBe(saves);
  expect(transfers.transactions).toBe(0);
  expect(transfers.movements).toEqual([]);
  expect(transfers.outbox).toEqual([]);
  expect(transfer.status).toBe(TRANSFER_STATUS.IN_TRANSIT);
  expect(transfer.receivedAt).toBeUndefined();
  expect(transfer.receivedBy).toBeUndefined();
  expect(transfer.lines[0]?.receivedQuantity).toBeUndefined();
  expect(transfer.lines[0]?.shortfall).toBeUndefined();
  expect(transfer.lines[0]?.unitCost).toBe(ORIGIN_COST);
  expect(transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(0);
  expect(stock.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    DESTINATION_COST,
  );
  expect(audit.commands).toEqual([]);
});

it("given 10 were dispatched at the copied origin cost, when 9 are received with an authorizer, then the shortfall stays on the line and transfer-in is that positive quantity", async () => {
  const onHand = grams(1000);
  const { transfers, stock, audit, receive } = harness();
  await dispatch(transfers, 10);
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, onHand, DESTINATION_COST);

  const transfer = await receive.execute(receipt(9, AUTHORIZER_ID));

  expect(transfer.status).toBe(TRANSFER_STATUS.RECEIVED_WITH_DIFFERENCES);
  expect(transfer.receivedAt).toBe(RECEIVED_AT);
  expect(transfer.receivedBy).toBe(ACTOR_ID);
  expect(transfer.lines).toEqual([
    {
      ingredientId: BEEF_ID,
      quantity: 10,
      unitCost: ORIGIN_COST,
      receivedQuantity: 9,
      shortfall: 1,
    },
  ]);
  expect(transfers.saves).toBe(1);
  expect(transfers.transactions).toBe(1);
  expect(transfers.movements).toEqual([
    {
      id: `movement_${TRANSFER_ID}_${BEEF_ID}_in`,
      tenantId: TENANT_ID,
      venueId: SITE_A,
      locationId: POINT_ID,
      ingredientId: BEEF_ID,
      quantity: 9,
      unitCost: ORIGIN_COST,
      type: MOVEMENT_TYPE.TRANSFER_IN,
      reference: TRANSFER_ID,
      occurredAt: RECEIVED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: null,
    },
  ]);
  expect(transfers.outbox).toEqual([]);
  expect(transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    nextAverageCost({
      onHand,
      averageCost: DESTINATION_COST,
      receivedQuantity: 9,
      receiptCost: ORIGIN_COST,
    }),
  );
  expect(stock.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    DESTINATION_COST,
  );
  expect(audit.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: AUTHORIZER_ID,
      deviceId: DEVICE_ID,
      siteId: SITE_A,
      action: "inventory.receive-transfer",
      entity: TRANSFER_ID,
      before: { status: TRANSFER_STATUS.IN_TRANSIT },
      after: {
        status: TRANSFER_STATUS.RECEIVED_WITH_DIFFERENCES,
        receivedAt: RECEIVED_AT,
        receivedBy: ACTOR_ID,
      },
      reason: "Transfer received",
    },
  ]);
});

it("given destination holds 1000 g at 10 and the origin cost is 12, when 1000 g are received, then one transaction sets the destination average to 11", async () => {
  const quantity = grams(1000);
  const { transfers, stock, receive } = harness();
  await dispatch(transfers, quantity);
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, quantity, DESTINATION_COST);

  const transfer = await receive.execute(receipt(quantity, null));

  expect(transfer.status).toBe(TRANSFER_STATUS.RECEIVED);
  expect(transfer.lines[0]?.shortfall).toBe(0);
  expect(transfer.lines[0]?.unitCost).toBe(ORIGIN_COST);
  expect(transfers.saves).toBe(1);
  expect(transfers.transactions).toBe(1);
  expect(transfers.movements).toEqual([
    {
      id: `movement_${TRANSFER_ID}_${BEEF_ID}_in`,
      tenantId: TENANT_ID,
      venueId: SITE_A,
      locationId: POINT_ID,
      ingredientId: BEEF_ID,
      quantity,
      unitCost: ORIGIN_COST,
      type: MOVEMENT_TYPE.TRANSFER_IN,
      reference: TRANSFER_ID,
      occurredAt: RECEIVED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: null,
    },
  ]);
  expect(transfers.outbox).toEqual([]);
  expect(transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(11);
  expect(stock.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    DESTINATION_COST,
  );
});

it("given destination on-hand is at or below zero, when the transfer is received, then the stored average is the copied receipt cost", async () => {
  const quantity = grams(1000);
  const empty = harness();
  const negative = harness();
  await dispatch(empty.transfers, quantity);
  await dispatch(negative.transfers, quantity);
  empty.stock.put(TENANT_ID, POINT_ID, BEEF_ID, 0, DESTINATION_COST);
  negative.stock.put(
    TENANT_ID,
    POINT_ID,
    BEEF_ID,
    grams(-200),
    DESTINATION_COST,
  );

  await empty.receive.execute(receipt(quantity, null));
  await negative.receive.execute(receipt(quantity, null));

  expect(empty.transfers.transactions).toBe(1);
  expect(negative.transfers.transactions).toBe(1);
  expect(empty.transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    ORIGIN_COST,
  );
  expect(negative.transfers.averageCost(TENANT_ID, POINT_ID, BEEF_ID)).toBe(
    ORIGIN_COST,
  );
  expect(empty.transfers.movements[0]?.quantity).toBe(quantity);
  expect(empty.transfers.movements[0]?.unitCost).toBe(ORIGIN_COST);
  expect(negative.transfers.movements[0]?.unitCost).toBe(ORIGIN_COST);
  expect(empty.transfers.movements[0]?.orderLineId).toBeNull();
  expect(empty.transfers.movements[0]?.role).toBeNull();
  expect(empty.transfers.movements[0]?.recipeVersion).toBeNull();
  expect(empty.transfers.outbox).toEqual([]);
  expect(negative.transfers.outbox).toEqual([]);
});
