import type { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import type { Transfer } from "#domain/transfer.js";

export interface TransferInMovement {
  id: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: typeof MOVEMENT_TYPE.TRANSFER_IN;
  reference: string;
  occurredAt: string;
  actorId: string;
  orderLineId: null;
  role: null;
  recipeVersion: null;
}

export interface TransferAverageUpdate {
  locationId: string;
  ingredientId: string;
  averageCost: number;
}

export interface TransferReceiptWrite {
  transfer: Transfer;
  movements: readonly TransferInMovement[];
  averages: readonly TransferAverageUpdate[];
}

export abstract class TransferRepository {
  abstract save(tenantId: string, transfer: Transfer): Promise<void>;

  abstract find(tenantId: string, transferId: string): Promise<Transfer | null>;

  abstract receive(
    tenantId: string,
    receipt: TransferReceiptWrite,
  ): Promise<void>;
}
