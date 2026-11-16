export interface TransferRequestLine {
  ingredientId: string;
  quantity: number;
}

export interface TransferRequestCommand {
  tenantId: string;
  destinationLocationId: string;
  lines: readonly TransferRequestLine[];
  alertId: string;
}

export abstract class TransferRequest {
  abstract request(command: TransferRequestCommand): Promise<string>;
}
