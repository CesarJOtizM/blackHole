import type {
  GetCheck,
  MarkAccountPaid,
  ViewVenueMenu,
} from "@blackhole/orders/application/entry-port";

interface PricedLine {
  id: string;
  productId: string;
  price: number;
  state: string;
  originTableId: string;
  menuClass?: string;
}

interface MenuProduct {
  id: string;
  taxClassification: string;
}

const menuClassOf = (
  line: PricedLine,
  products: readonly MenuProduct[],
): string => {
  if (typeof line.menuClass === "string") {
    return line.menuClass;
  }

  return (
    products.find((product) => product.id === line.productId)
      ?.taxClassification ?? ""
  );
};

export class OrdersAccount {
  private paidMarks = 0;

  constructor(
    private readonly getCheck: GetCheck,
    private readonly viewVenueMenu: ViewVenueMenu,
    private readonly markAccountPaid: MarkAccountPaid,
  ) {}

  markCount(): number {
    return this.paidMarks;
  }

  async findCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<{
    checkId: string;
    tableId: string;
    accountCop: number;
    lines: {
      lineId: string;
      productId: string;
      priceCop: number;
      originTableId: string;
      menuClass: string;
    }[];
  } | null> {
    const check = await this.getCheck.execute({ tenantId, venueId, checkId });

    if (check === null) {
      return null;
    }

    const menu = await this.viewVenueMenu.execute({ tenantId, venueId });
    const products = menu?.products ?? [];

    return {
      checkId: check.checkId,
      tableId: check.tableId,
      accountCop: check.total,
      lines: check.orders.flatMap((order) =>
        order.lines
          .filter((line) => line.state !== "held")
          .map((line) => ({
            lineId: line.id,
            productId: line.productId,
            priceCop: line.price,
            originTableId: line.originTableId,
            menuClass: menuClassOf(line, products),
          })),
      ),
    };
  }

  async markPaid(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<void> {
    const check = await this.getCheck.execute({ tenantId, venueId, checkId });

    if (check === null) {
      return;
    }

    await this.markAccountPaid.execute({
      tenantId,
      venueId,
      tableId: check.tableId,
    });
    this.paidMarks += 1;
  }
}
