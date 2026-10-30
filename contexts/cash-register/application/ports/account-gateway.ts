export interface AccountLine {
  lineId: string;
  productId: string;
  priceCop: number;
  originTableId: string;
  menuClass: string;
}

export interface AccountCheck {
  checkId: string;
  tableId: string;
  accountCop: number;
  lines: readonly AccountLine[];
}

export abstract class AccountGateway {
  abstract findCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountCheck | null>;

  abstract markPaid(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<void>;
}
