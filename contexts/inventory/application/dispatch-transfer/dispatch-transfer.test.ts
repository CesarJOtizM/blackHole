import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  DispatchTransfer,
  type TransferOutRecord,
  TransferStock,
} from "#application/dispatch-transfer/dispatch-transfer.js";
import {
  type TransferReceiptWrite,
  TransferRepository,
} from "#application/ports/transfer-repository.js";
import type { TransferVoucherDraft } from "#application/ports/transfer-voucher.js";
import { TransferVoucher } from "#application/ports/transfer-voucher.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import {
  InsufficientOnHand,
  TRANSFER_STATUS,
  Transfer,
} from "#domain/transfer.js";

const TENANT_ID = "organization_tenant";
const SITE_A = "venue_site_a";
const SITE_B = "venue_site_b";
const CENTRAL_ID = "location_central";
const SITE_WAREHOUSE_ID = "location_site_warehouse";
const POINT_ID = "location_point";
const OTHER_POINT_ID = "location_other_point";
const TRANSFER_ID = "transfer_beef";
const BEEF_ID = "ingredient_beef";
const ACTOR_ID = "user_keeper";
const DEVICE_ID = "device_keeper";
const DISPATCHED_AT = "2026-11-13T18:00:00.000Z";
const AVERAGE_COST = 12;

class MemoryTransferRepository extends TransferRepository {
  readonly records: Array<{ tenantId: string; transfer: Transfer }> = [];
  saves = 0;

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

  receive(_tenantId: string, _receipt: TransferReceiptWrite): Promise<void> {
    return Promise.reject(
      new Error("Transfer receipt is not part of this double."),
    );
  }
}

class MemoryTransferStock extends TransferStock {
  readonly movements: TransferOutRecord[] = [];
  readonly outbox: readonly never[] = [];
  private readonly onHand = new Map<
    string,
    { onHand: number; averageCost: number }
  >();
  private readonly averages = new Map<string, number>();

  put(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    onHand: number,
    averageCost: number,
  ): void {
    const key = stockKey(tenantId, locationId, ingredientId);
    this.onHand.set(key, { onHand, averageCost });
    this.averages.set(key, averageCost);
  }

  read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ onHand: number; averageCost: number } | null> {
    return Promise.resolve(
      this.onHand.get(stockKey(tenantId, locationId, ingredientId)) ?? null,
    );
  }

  append(movements: readonly TransferOutRecord[]): Promise<void> {
    this.movements.push(...movements);
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

class MemoryVoucher extends TransferVoucher {
  readonly printed: TransferVoucherDraft[] = [];

  print(voucher: TransferVoucherDraft): Promise<void> {
    this.printed.push(voucher);
    return Promise.resolve();
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

const stockKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const harness = () => {
  const transfers = new MemoryTransferRepository();
  const stock = new MemoryTransferStock();
  const vouchers = new MemoryVoucher();
  const audit = new CapturedAudit();
  const dispatch = new DispatchTransfer(transfers, stock, vouchers, audit);

  return { transfers, stock, vouchers, audit, dispatch };
};

const request = async (
  transfers: MemoryTransferRepository,
  originLocationId: string,
  destinationLocationId: string,
  quantity: number,
) => {
  const transfer = Transfer.request({
    id: TRANSFER_ID,
    originLocationId,
    destinationLocationId,
    lines: [{ ingredientId: BEEF_ID, quantity }],
  });
  await transfers.save(TENANT_ID, transfer);
  return transfer;
};

const movement = (
  venueId: string,
  locationId: string,
  quantity: number,
): TransferOutRecord => ({
  id: `movement_${TRANSFER_ID}_${BEEF_ID}`,
  tenantId: TENANT_ID,
  venueId,
  locationId,
  ingredientId: BEEF_ID,
  quantity,
  unitCost: AVERAGE_COST,
  type: MOVEMENT_TYPE.TRANSFER_OUT,
  reference: TRANSFER_ID,
  occurredAt: DISPATCHED_AT,
  actorId: ACTOR_ID,
  orderLineId: null,
  role: null,
  recipeVersion: null,
});

it("given a company warehouse holds 10 at 12, when 4 are dispatched to site A, then the out movement copies that cost, the voucher is printed, and the destination venue is stored", async () => {
  const { transfers, stock, vouchers, audit, dispatch } = harness();
  await request(transfers, CENTRAL_ID, POINT_ID, 4);
  stock.put(TENANT_ID, CENTRAL_ID, BEEF_ID, 10, AVERAGE_COST);

  const transfer = await dispatch.execute({
    tenantId: TENANT_ID,
    transferId: TRANSFER_ID,
    actorId: ACTOR_ID,
    deviceId: DEVICE_ID,
    occurredAt: DISPATCHED_AT,
    originVenueId: null,
    destinationVenueId: SITE_A,
  });

  expect(transfer.status).toBe(TRANSFER_STATUS.IN_TRANSIT);
  expect(transfer.dispatchedAt).toBe(DISPATCHED_AT);
  expect(transfer.inTransitAt).toBe(DISPATCHED_AT);
  expect(transfer.dispatchedBy).toBe(ACTOR_ID);
  expect(transfer.receivedAt).toBeUndefined();
  expect(transfer.lines).toEqual([
    { ingredientId: BEEF_ID, quantity: 4, unitCost: AVERAGE_COST },
  ]);
  expect(stock.movements).toEqual([
    {
      id: `movement_${TRANSFER_ID}_${BEEF_ID}`,
      tenantId: TENANT_ID,
      venueId: SITE_A,
      locationId: CENTRAL_ID,
      ingredientId: BEEF_ID,
      quantity: -4,
      unitCost: AVERAGE_COST,
      type: MOVEMENT_TYPE.TRANSFER_OUT,
      reference: TRANSFER_ID,
      occurredAt: DISPATCHED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: null,
    },
  ]);
  expect(stock.outbox).toEqual([]);
  expect(stock.averageCost(TENANT_ID, CENTRAL_ID, BEEF_ID)).toBe(AVERAGE_COST);
  expect(vouchers.printed).toEqual([
    {
      document: "transfer",
      tenantId: TENANT_ID,
      transferId: TRANSFER_ID,
      originLocationId: CENTRAL_ID,
      destinationLocationId: POINT_ID,
      lines: [{ ingredientId: BEEF_ID, quantity: 4 }],
    },
  ]);
  expect(audit.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: SITE_A,
      action: "inventory.dispatch-transfer",
      entity: TRANSFER_ID,
      before: { status: TRANSFER_STATUS.REQUESTED },
      after: {
        status: TRANSFER_STATUS.IN_TRANSIT,
        dispatchedAt: DISPATCHED_AT,
        inTransitAt: DISPATCHED_AT,
      },
      reason: "Transfer dispatched",
    },
  ]);
});

it("given a site warehouse dispatches to another site, when the transfer leaves, then the movement stores the origin venue", async () => {
  const { transfers, stock, dispatch } = harness();
  await request(transfers, SITE_WAREHOUSE_ID, OTHER_POINT_ID, 4);
  stock.put(TENANT_ID, SITE_WAREHOUSE_ID, BEEF_ID, 10, AVERAGE_COST);

  await dispatch.execute({
    tenantId: TENANT_ID,
    transferId: TRANSFER_ID,
    actorId: ACTOR_ID,
    deviceId: DEVICE_ID,
    occurredAt: DISPATCHED_AT,
    originVenueId: SITE_A,
    destinationVenueId: SITE_B,
  });

  expect(stock.movements).toEqual([movement(SITE_A, SITE_WAREHOUSE_ID, -4)]);
  expect(stock.outbox).toEqual([]);
  expect(stock.averageCost(TENANT_ID, SITE_WAREHOUSE_ID, BEEF_ID)).toBe(
    AVERAGE_COST,
  );
});

it("given origin on-hand is 4, when 5 are dispatched, then the dispatch is rejected and nothing is stamped", async () => {
  const { transfers, stock, vouchers, audit, dispatch } = harness();
  const transfer = await request(transfers, CENTRAL_ID, POINT_ID, 5);
  stock.put(TENANT_ID, CENTRAL_ID, BEEF_ID, 4, AVERAGE_COST);
  const saves = transfers.saves;

  const pending = dispatch.execute({
    tenantId: TENANT_ID,
    transferId: TRANSFER_ID,
    actorId: ACTOR_ID,
    deviceId: DEVICE_ID,
    occurredAt: DISPATCHED_AT,
    originVenueId: null,
    destinationVenueId: SITE_A,
  });

  await expect(pending).rejects.toBeInstanceOf(InsufficientOnHand);
  expect(transfers.saves).toBe(saves);
  expect(transfer.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(transfer.dispatchedAt).toBeUndefined();
  expect(transfer.inTransitAt).toBeUndefined();
  expect(transfer.dispatchedBy).toBeUndefined();
  expect(transfer.lines[0]?.unitCost).toBeUndefined();
  expect(stock.movements).toEqual([]);
  expect(stock.outbox).toEqual([]);
  expect(vouchers.printed).toEqual([]);
  expect(audit.commands).toEqual([]);
  expect(stock.averageCost(TENANT_ID, CENTRAL_ID, BEEF_ID)).toBe(AVERAGE_COST);
});
