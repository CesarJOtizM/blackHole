import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import type { TransferRepository } from "#application/ports/transfer-repository.js";
import type { TransferVoucher } from "#application/ports/transfer-voucher.js";
import type { Transfer, TransferMovement } from "#domain/transfer.js";

const DISPATCH_AUDIT = "inventory.dispatch-transfer";

export class UnknownTransfer extends Error {
  constructor() {
    super("The transfer does not exist.");
    this.name = "UnknownTransfer";
  }
}

export interface DispatchTransferInput {
  tenantId: string;
  transferId: string;
  actorId: string;
  deviceId: string;
  occurredAt: string;
  originVenueId: string | null;
  destinationVenueId: string;
}

export interface OriginStock {
  onHand: number;
  averageCost: number;
}

export interface TransferOutRecord {
  id: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: TransferMovement["type"];
  reference: string;
  occurredAt: string;
  actorId: string;
  orderLineId: null;
  role: null;
  recipeVersion: null;
}

export abstract class TransferStock {
  abstract read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<OriginStock | null>;

  abstract append(movements: readonly TransferOutRecord[]): Promise<void>;
}

export class DispatchTransfer {
  constructor(
    private readonly transfers: TransferRepository,
    private readonly stock: TransferStock,
    private readonly vouchers: TransferVoucher,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: DispatchTransferInput): Promise<Transfer> {
    const transfer = await this.transfers.find(
      input.tenantId,
      input.transferId,
    );

    if (!transfer) {
      throw new UnknownTransfer();
    }

    const origin = (
      await Promise.all(
        transfer.lines.map(async (line) => {
          const stock = await this.stock.read(
            input.tenantId,
            transfer.originLocationId,
            line.ingredientId,
          );

          if (!stock) {
            return null;
          }

          return {
            ingredientId: line.ingredientId,
            onHand: stock.onHand,
            averageCost: stock.averageCost,
          };
        }),
      )
    ).flatMap((item) => (item === null ? [] : [item]));

    const movements = transfer.dispatch({
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      origin,
    });
    const recorded = outMovements(input, transfer, movements);

    await this.transfers.save(input.tenantId, transfer);
    await this.stock.append(recorded);
    await this.vouchers.print({
      document: "transfer",
      tenantId: input.tenantId,
      transferId: transfer.id,
      originLocationId: transfer.originLocationId,
      destinationLocationId: transfer.destinationLocationId,
      lines: transfer.lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
      })),
    });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.deviceId,
      siteId: recorded[0]?.venueId ?? input.destinationVenueId,
      action: DISPATCH_AUDIT,
      entity: transfer.id,
      before: { status: "requested" },
      after: {
        status: transfer.status,
        dispatchedAt: transfer.dispatchedAt,
        inTransitAt: transfer.inTransitAt,
      },
      reason: "Transfer dispatched",
    });

    return transfer;
  }
}

const outMovements = (
  input: DispatchTransferInput,
  transfer: Transfer,
  movements: readonly TransferMovement[],
): TransferOutRecord[] => {
  // A company warehouse has no venue. stock_movements.venue_id is not null,
  // so that dispatch stores the destination venue. A site dispatch stores its own.
  const venueId = input.originVenueId ?? input.destinationVenueId;

  return movements.map((movement) => ({
    id: `movement_${transfer.id}_${movement.ingredientId}`,
    tenantId: input.tenantId,
    venueId,
    locationId: transfer.originLocationId,
    ingredientId: movement.ingredientId,
    quantity: movement.quantity,
    unitCost: movement.unitCost,
    type: movement.type,
    reference: transfer.id,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    orderLineId: null,
    role: null,
    recipeVersion: null,
  }));
};
