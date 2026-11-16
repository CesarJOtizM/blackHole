import type {
  TransferInMovement,
  TransferReceiptWrite,
} from "#application/ports/transfer-repository.js";
import { TransferRepository } from "#application/ports/transfer-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import type { TransferStatus } from "#domain/transfer.js";
import { TRANSFER_STATUS, Transfer } from "#domain/transfer.js";

const RECEIPT_FAILED = "The transfer receipt insert failed.";

interface StoredLine {
  ingredientId: string;
  quantity: number;
  unitCost: number | null;
  receivedQuantity: number | null;
  shortfall: number | null;
}

interface StoredTransfer {
  id: string;
  originLocationId: string;
  destinationLocationId: string;
  status: TransferStatus;
  dispatchedAt: string | null;
  inTransitAt: string | null;
  dispatchedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  lines: StoredLine[];
}

interface Snapshot {
  transfers: Map<string, StoredTransfer>;
  storedMovements: TransferInMovement[];
  balances: Map<string, number>;
  averages: Map<string, number>;
}

const transferKey = (tenantId: string, transferId: string): string =>
  `${tenantId}\u0000${transferId}`;

const balanceKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const copyLine = (line: StoredLine): StoredLine => ({ ...line });

const copyTransfer = (transfer: StoredTransfer): StoredTransfer => ({
  ...transfer,
  lines: transfer.lines.map(copyLine),
});

const copyMovement = (movement: TransferInMovement): TransferInMovement => ({
  ...movement,
});

const rehydrate = (stored: StoredTransfer): Transfer => {
  const transfer = Transfer.request({
    id: stored.id,
    originLocationId: stored.originLocationId,
    destinationLocationId: stored.destinationLocationId,
    lines: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      quantity: line.quantity,
    })),
  });

  if (stored.status === TRANSFER_STATUS.REQUESTED) {
    return transfer;
  }

  const occurredAt = stored.dispatchedAt ?? stored.inTransitAt;
  const actorId = stored.dispatchedBy;

  if (occurredAt === null || actorId === null) {
    throw new Error("A dispatched transfer is missing its stamp.");
  }

  transfer.dispatch({
    actorId,
    occurredAt,
    origin: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      onHand: line.quantity,
      averageCost: line.unitCost ?? 0,
    })),
  });

  if (stored.status === TRANSFER_STATUS.IN_TRANSIT) {
    return transfer;
  }

  if (stored.receivedAt === null || stored.receivedBy === null) {
    throw new Error("A received transfer is missing its stamp.");
  }

  transfer.receive({
    actorId: stored.receivedBy,
    occurredAt: stored.receivedAt,
    lines: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      receivedQuantity: line.receivedQuantity ?? 0,
      onHand: 0,
      averageCost: 0,
    })),
  });

  return transfer;
};

const snapshotOf = (transfer: Transfer): StoredTransfer => ({
  id: transfer.id,
  originLocationId: transfer.originLocationId,
  destinationLocationId: transfer.destinationLocationId,
  status: transfer.status,
  dispatchedAt: transfer.dispatchedAt ?? null,
  inTransitAt: transfer.inTransitAt ?? null,
  dispatchedBy: transfer.dispatchedBy ?? null,
  receivedAt: transfer.receivedAt ?? null,
  receivedBy: transfer.receivedBy ?? null,
  lines: transfer.lines.map((line) => ({
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.unitCost ?? null,
    receivedQuantity: line.receivedQuantity ?? null,
    shortfall: line.shortfall ?? null,
  })),
});

export class InMemoryTransferRepository extends TransferRepository {
  private readonly transfers = new Map<string, StoredTransfer>();
  private storedMovements: TransferInMovement[] = [];
  private readonly balances = new Map<string, number>();
  private readonly averages = new Map<string, number>();
  // Transfer stock stays out of stock_movement_outbox. Sale columns stay null.
  private readonly outbox: { tenantId: string }[] = [];
  private failAt: number | null = null;

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.balances.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.averages.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  async movements(tenantId: string): Promise<readonly TransferInMovement[]> {
    return this.storedMovements
      .filter(
        (movement) =>
          movement.tenantId === tenantId &&
          movement.type === MOVEMENT_TYPE.TRANSFER_IN,
      )
      .map(copyMovement);
  }

  async outboxCount(tenantId: string): Promise<number> {
    return this.outbox.filter((row) => row.tenantId === tenantId).length;
  }

  async seedBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
    averageCost: number,
  ): Promise<void> {
    const key = balanceKey(tenantId, locationId, ingredientId);
    this.balances.set(key, quantity);
    this.averages.set(key, averageCost);
  }

  override async save(tenantId: string, transfer: Transfer): Promise<void> {
    this.transfers.set(
      transferKey(tenantId, transfer.id),
      snapshotOf(transfer),
    );
  }

  override async find(
    tenantId: string,
    transferId: string,
  ): Promise<Transfer | null> {
    const stored = this.transfers.get(transferKey(tenantId, transferId));

    return stored === undefined ? null : rehydrate(stored);
  }

  override async receive(
    tenantId: string,
    receipt: TransferReceiptWrite,
  ): Promise<void> {
    const failAt = this.failAt;
    this.failAt = null;
    const snapshot = this.capture();

    try {
      this.transfers.set(
        transferKey(tenantId, receipt.transfer.id),
        snapshotOf(receipt.transfer),
      );

      for (const [index, movement] of receipt.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(RECEIPT_FAILED);
        }

        this.append(movement, receipt);
      }
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  private append(
    movement: TransferInMovement,
    receipt: TransferReceiptWrite,
  ): void {
    if (movement.type !== MOVEMENT_TYPE.TRANSFER_IN) {
      throw new Error(RECEIPT_FAILED);
    }

    this.storedMovements.push(copyMovement(movement));
    const key = balanceKey(
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    this.balances.set(key, (this.balances.get(key) ?? 0) + movement.quantity);
    const average = receipt.averages.find(
      (item) =>
        item.locationId === movement.locationId &&
        item.ingredientId === movement.ingredientId,
    );

    if (average) {
      this.averages.set(key, average.averageCost);
    }
  }

  private capture(): Snapshot {
    return {
      transfers: new Map(
        [...this.transfers.entries()].map(([key, value]) => [
          key,
          copyTransfer(value),
        ]),
      ),
      storedMovements: this.storedMovements.map(copyMovement),
      balances: new Map(this.balances),
      averages: new Map(this.averages),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.transfers.clear();
    this.balances.clear();
    this.averages.clear();
    this.storedMovements = snapshot.storedMovements;

    for (const [key, transfer] of snapshot.transfers) {
      this.transfers.set(key, transfer);
    }

    for (const [key, quantity] of snapshot.balances) {
      this.balances.set(key, quantity);
    }

    for (const [key, average] of snapshot.averages) {
      this.averages.set(key, average);
    }
  }
}
