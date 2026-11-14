import { expect, it } from "vitest";

import {
  type TransferReceiptWrite,
  TransferRepository,
} from "#application/ports/transfer-repository.js";
import { WarehouseSupply } from "#application/ports/warehouse-supply.js";
import {
  RequestTransfer,
  UnlinkedWarehouse,
} from "#application/request-transfer/request-transfer.js";
import type { Transfer } from "#domain/transfer.js";
import { TRANSFER_STATUS } from "#domain/transfer.js";

const TENANT_ID = "organization_tenant";
const SITE_A = "venue_site_a";
const CENTRAL_ID = "location_central";
const NORTH_ID = "location_north";
const POINT_ID = "location_point";
const TRANSFER_ID = "transfer_beef";
const BEEF_ID = "ingredient_beef";
const RICE_ID = "ingredient_rice";

class MemoryWarehouseSupply extends WarehouseSupply {
  private readonly links = new Set<string>();

  link(tenantId: string, venueId: string, warehouseLocationId: string): void {
    this.links.add(`${tenantId}:${venueId}:${warehouseLocationId}`);
  }

  linked(
    tenantId: string,
    venueId: string,
    warehouseLocationId: string,
  ): Promise<boolean> {
    return Promise.resolve(
      this.links.has(`${tenantId}:${venueId}:${warehouseLocationId}`),
    );
  }
}

class MemoryTransferRepository extends TransferRepository {
  readonly records: Array<{ tenantId: string; transfer: Transfer }> = [];
  readonly movements: readonly never[] = [];

  save(tenantId: string, transfer: Transfer): Promise<void> {
    this.records.push({ tenantId, transfer });
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

const requestFrom = (supplies: MemoryWarehouseSupply) => {
  const transfers = new MemoryTransferRepository();
  const request = new RequestTransfer(supplies, transfers);

  return { transfers, request };
};

it("given North does not supply site A, when site A requests from it, then the request is rejected and no stock movement is stored", async () => {
  const supplies = new MemoryWarehouseSupply();
  supplies.link(TENANT_ID, SITE_A, CENTRAL_ID);
  const { transfers, request } = requestFrom(supplies);

  const pending = request.execute({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    transferId: TRANSFER_ID,
    originLocationId: NORTH_ID,
    destinationLocationId: POINT_ID,
    lines: [{ ingredientId: BEEF_ID, quantity: 16 }],
  });

  await expect(pending).rejects.toBeInstanceOf(UnlinkedWarehouse);
  expect(transfers.records).toEqual([]);
  expect(transfers.movements).toEqual([]);
});

it("given Central supplies site A, when site A requests lines, then those lines stay requested and no stock movement is written", async () => {
  const supplies = new MemoryWarehouseSupply();
  supplies.link(TENANT_ID, SITE_A, CENTRAL_ID);
  const { transfers, request } = requestFrom(supplies);
  const lines = [
    { ingredientId: BEEF_ID, quantity: 16 },
    { ingredientId: RICE_ID, quantity: 4 },
  ];

  const transfer = await request.execute({
    tenantId: TENANT_ID,
    venueId: SITE_A,
    transferId: TRANSFER_ID,
    originLocationId: CENTRAL_ID,
    destinationLocationId: POINT_ID,
    lines,
  });

  expect(transfer.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(transfer.lines).toEqual(lines);
  expect(transfer.dispatchedAt).toBeUndefined();
  expect(transfer.inTransitAt).toBeUndefined();
  expect(transfer.dispatchedBy).toBeUndefined();
  const stored = await transfers.find(TENANT_ID, TRANSFER_ID);
  expect(stored?.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(stored?.originLocationId).toBe(CENTRAL_ID);
  expect(stored?.destinationLocationId).toBe(POINT_ID);
  expect(stored?.lines).toEqual(lines);
  expect(stored?.lines.every((line) => line.unitCost === undefined)).toBe(true);
  expect(transfers.movements).toEqual([]);
});
