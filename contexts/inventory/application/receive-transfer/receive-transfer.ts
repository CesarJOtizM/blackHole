import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import type {
  TransferInMovement,
  TransferRepository,
} from "#application/ports/transfer-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import {
  TRANSFER_STATUS,
  type Transfer,
  type TransferMovement,
} from "#domain/transfer.js";

const RECEIPT_AUDIT = "inventory.receive-transfer";

export class UnknownTransfer extends Error {
  constructor() {
    super("The transfer does not exist.");
    this.name = "UnknownTransfer";
  }
}

export class UnauthorizedTransferDifference extends Error {
  constructor() {
    super("A short receipt needs an authorizer.");
    this.name = "UnauthorizedTransferDifference";
  }
}

export interface ReceiveTransferLine {
  ingredientId: string;
  receivedQuantity: number;
}

export interface ReceiveTransferInput {
  tenantId: string;
  transferId: string;
  actorId: string;
  deviceId: string;
  occurredAt: string;
  destinationVenueId: string;
  authorizerId: string | null;
  lines: readonly ReceiveTransferLine[];
}

export interface DestinationBalance {
  onHand: number;
  averageCost: number;
}

export abstract class DestinationStock {
  abstract read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<DestinationBalance | null>;
}

export class ReceiveTransfer {
  constructor(
    private readonly transfers: TransferRepository,
    private readonly stock: DestinationStock,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ReceiveTransferInput): Promise<Transfer> {
    const transfer = await this.transfers.find(
      input.tenantId,
      input.transferId,
    );

    if (!transfer) {
      throw new UnknownTransfer();
    }

    if (alreadyReceived(transfer)) {
      return transfer;
    }

    if (shortfallWithoutAuthorizer(transfer, input)) {
      throw new UnauthorizedTransferDifference();
    }

    const lines = await Promise.all(
      transfer.lines.map(async (line) => {
        const received = input.lines.find(
          (item) => item.ingredientId === line.ingredientId,
        );
        const balance = await this.stock.read(
          input.tenantId,
          transfer.destinationLocationId,
          line.ingredientId,
        );

        return {
          ingredientId: line.ingredientId,
          receivedQuantity: received?.receivedQuantity ?? Number.NaN,
          onHand: balance?.onHand ?? 0,
          averageCost: balance?.averageCost ?? 0,
        };
      }),
    );
    const receipt = transfer.receive({
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      lines,
    });
    // One repository call stores the receipt, the positive transfer-in rows,
    // and the destination average Transfer.receive already computed.
    // Sale columns stay null. This path does not enqueue after_sales.
    const movements = inMovements(input, transfer, receipt.movements);

    await this.transfers.receive(input.tenantId, {
      transfer,
      movements,
      averages: receipt.averages.map((average) => ({
        locationId: transfer.destinationLocationId,
        ingredientId: average.ingredientId,
        averageCost: average.averageCost,
      })),
    });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.destinationVenueId,
      action: RECEIPT_AUDIT,
      entity: transfer.id,
      before: { status: TRANSFER_STATUS.IN_TRANSIT },
      after: {
        status: transfer.status,
        receivedAt: transfer.receivedAt,
        receivedBy: transfer.receivedBy,
      },
      reason: "Transfer received",
    });

    return transfer;
  }
}

const alreadyReceived = (transfer: Transfer): boolean =>
  transfer.status === TRANSFER_STATUS.RECEIVED ||
  transfer.status === TRANSFER_STATUS.RECEIVED_WITH_DIFFERENCES;

const hasAuthorizer = (authorizerId: string | null): boolean =>
  authorizerId !== null && authorizerId.length > 0;

const shortfallWithoutAuthorizer = (
  transfer: Transfer,
  input: ReceiveTransferInput,
): boolean => {
  if (
    transfer.status !== TRANSFER_STATUS.IN_TRANSIT ||
    hasAuthorizer(input.authorizerId)
  ) {
    return false;
  }

  return transfer.lines.some((line) => {
    const received = input.lines.find(
      (item) => item.ingredientId === line.ingredientId,
    );

    return received !== undefined && received.receivedQuantity < line.quantity;
  });
};

const inMovements = (
  input: ReceiveTransferInput,
  transfer: Transfer,
  movements: readonly TransferMovement[],
): TransferInMovement[] =>
  movements.map((movement) => ({
    id: `movement_${transfer.id}_${movement.ingredientId}_in`,
    tenantId: input.tenantId,
    venueId: input.destinationVenueId,
    locationId: transfer.destinationLocationId,
    ingredientId: movement.ingredientId,
    quantity: movement.quantity,
    unitCost: movement.unitCost,
    type: MOVEMENT_TYPE.TRANSFER_IN,
    reference: transfer.id,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    orderLineId: null,
    role: null,
    recipeVersion: null,
  }));
