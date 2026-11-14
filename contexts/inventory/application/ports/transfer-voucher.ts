export interface TransferVoucherLine {
  ingredientId: string;
  quantity: number;
}

export interface TransferVoucherDraft {
  document: "transfer";
  tenantId: string;
  transferId: string;
  originLocationId: string;
  destinationLocationId: string;
  lines: readonly TransferVoucherLine[];
}

export abstract class TransferVoucher {
  abstract print(voucher: TransferVoucherDraft): Promise<void>;
}
