import type { TransferRepository } from "#application/ports/transfer-repository.js";
import type { WarehouseSupply } from "#application/ports/warehouse-supply.js";
import { Transfer } from "#domain/transfer.js";

export class UnlinkedWarehouse extends Error {
  constructor() {
    super(
      "A replenishment request must target a warehouse that supplies the site.",
    );
    this.name = "UnlinkedWarehouse";
  }
}

export interface RequestTransferLine {
  ingredientId: string;
  quantity: number;
}

export interface RequestTransferInput {
  tenantId: string;
  venueId: string;
  transferId: string;
  originLocationId: string;
  destinationLocationId: string;
  lines: readonly RequestTransferLine[];
}

export class RequestTransfer {
  constructor(
    private readonly supplies: WarehouseSupply,
    private readonly transfers: TransferRepository,
  ) {}

  async execute(input: RequestTransferInput): Promise<Transfer> {
    const linked = await this.supplies.linked(
      input.tenantId,
      input.venueId,
      input.originLocationId,
    );

    if (!linked) {
      throw new UnlinkedWarehouse();
    }

    const transfer = Transfer.request({
      id: input.transferId,
      originLocationId: input.originLocationId,
      destinationLocationId: input.destinationLocationId,
      lines: input.lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
      })),
    });
    await this.transfers.save(input.tenantId, transfer);
    return transfer;
  }
}
