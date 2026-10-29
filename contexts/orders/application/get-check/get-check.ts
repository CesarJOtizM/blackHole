import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { Check } from "#domain/check.js";

export interface GetCheckInput {
  tenantId: string;
  venueId: string;
  checkId: string;
}

export interface CheckAccount {
  checkId: string;
  tableId: string;
  tenantId: string;
  venueId: string;
  lineIds: readonly string[];
  total: number;
  orders: Check["orders"];
}

export class GetCheck {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: GetCheckInput): Promise<CheckAccount | null> {
    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (
      check === null ||
      check.tenantId !== input.tenantId ||
      check.venueId !== input.venueId ||
      check.id !== input.checkId
    ) {
      return null;
    }

    return {
      checkId: check.id,
      tableId: check.tableId,
      tenantId: check.tenantId,
      venueId: check.venueId,
      lineIds: check.orders.flatMap((order) =>
        order.lines.map((line) => line.id),
      ),
      total: check.total,
      orders: check.orders,
    };
  }
}
