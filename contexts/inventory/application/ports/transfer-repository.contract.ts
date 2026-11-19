import { expect, it } from "vitest";
import type {
  TransferReceiptWrite,
  TransferRepository,
} from "#application/ports/transfer-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import { TRANSFER_STATUS, Transfer } from "#domain/transfer.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const ORIGIN_ID = "location_central";
const DESTINATION_ID = "location_point";
const BEEF_ID = "ingredient_beef";
const ACTOR_ID = "user_keeper";
const OCCURRED_AT = "2026-06-01T12:00:00.000Z";
const TRANSFER_ID = "transfer_beef";
const BEEF_QUANTITY = 1000;
const DESTINATION_ON_HAND = 1000;
const DESTINATION_AVERAGE = 10;
const ORIGIN_ON_HAND = 4000;
const ORIGIN_AVERAGE = 12;
const BLENDED_AVERAGE = 11;

export interface StoredTransferMovement {
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

export interface TransferContractSubject {
  transfers: TransferRepository;
  balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
  averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
  movements(tenantId: string): Promise<readonly StoredTransferMovement[]>;
  outboxCount(tenantId: string): Promise<number>;
  failOnInsert(ordinal: number): void;
  seedBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
    averageCost: number,
  ): Promise<void>;
}

const inboundMovement = (): StoredTransferMovement => ({
  id: `movement_${TRANSFER_ID}_${BEEF_ID}_in`,
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: DESTINATION_ID,
  ingredientId: BEEF_ID,
  quantity: BEEF_QUANTITY,
  unitCost: ORIGIN_AVERAGE,
  type: MOVEMENT_TYPE.TRANSFER_IN,
  reference: TRANSFER_ID,
  occurredAt: OCCURRED_AT,
  actorId: ACTOR_ID,
  orderLineId: null,
  role: null,
  recipeVersion: null,
});

const dispatched = (): Transfer => {
  const transfer = Transfer.request({
    id: TRANSFER_ID,
    originLocationId: ORIGIN_ID,
    destinationLocationId: DESTINATION_ID,
    lines: [{ ingredientId: BEEF_ID, quantity: BEEF_QUANTITY }],
  });
  transfer.dispatch({
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    origin: [
      {
        ingredientId: BEEF_ID,
        onHand: BEEF_QUANTITY,
        averageCost: ORIGIN_AVERAGE,
      },
    ],
  });

  return transfer;
};

const receiptOf = (transfer: Transfer): TransferReceiptWrite => {
  const receipt = transfer.receive({
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: BEEF_ID,
        receivedQuantity: BEEF_QUANTITY,
        onHand: DESTINATION_ON_HAND,
        averageCost: DESTINATION_AVERAGE,
      },
    ],
  });

  return {
    transfer,
    movements: [inboundMovement()],
    averages: receipt.averages.map((average) => ({
      locationId: DESTINATION_ID,
      ingredientId: average.ingredientId,
      averageCost: average.averageCost,
    })),
  };
};

const seedStock = async (subject: TransferContractSubject): Promise<void> => {
  await subject.seedBalance(
    TENANT_A,
    ORIGIN_ID,
    BEEF_ID,
    ORIGIN_ON_HAND,
    ORIGIN_AVERAGE,
  );
  await subject.seedBalance(
    TENANT_A,
    DESTINATION_ID,
    BEEF_ID,
    DESTINATION_ON_HAND,
    DESTINATION_AVERAGE,
  );
};

export function transferRepositoryContract(
  open: () => TransferContractSubject | Promise<TransferContractSubject>,
): void {
  it("given 1000 g at 10 and a transfer in of 1000 g at 12, when the receipt is stored, then the destination balance is 2000 g at 11 and the origin balance stays", async () => {
    const subject = await open();
    const transfer = dispatched();
    await subject.transfers.save(TENANT_A, transfer);
    await seedStock(subject);
    const queued = await subject.outboxCount(TENANT_A);

    const receipt = receiptOf(transfer);
    await subject.transfers.receive(TENANT_A, receipt);
    const stored = await subject.transfers.find(TENANT_A, TRANSFER_ID);

    expect(receipt.averages).toEqual([
      {
        locationId: DESTINATION_ID,
        ingredientId: BEEF_ID,
        averageCost: BLENDED_AVERAGE,
      },
    ]);
    expect(stored?.status).toBe(TRANSFER_STATUS.RECEIVED);
    expect(stored?.lines).toEqual([
      {
        ingredientId: BEEF_ID,
        quantity: BEEF_QUANTITY,
        unitCost: ORIGIN_AVERAGE,
        receivedQuantity: BEEF_QUANTITY,
        shortfall: 0,
      },
    ]);
    expect(await subject.balance(TENANT_A, DESTINATION_ID, BEEF_ID)).toBe(
      DESTINATION_ON_HAND + BEEF_QUANTITY,
    );
    expect(await subject.averageCost(TENANT_A, DESTINATION_ID, BEEF_ID)).toBe(
      BLENDED_AVERAGE,
    );
    expect(await subject.balance(TENANT_A, ORIGIN_ID, BEEF_ID)).toBe(
      ORIGIN_ON_HAND,
    );
    expect(await subject.averageCost(TENANT_A, ORIGIN_ID, BEEF_ID)).toBe(
      ORIGIN_AVERAGE,
    );
    expect(await subject.movements(TENANT_A)).toEqual([inboundMovement()]);
    expect(await subject.outboxCount(TENANT_A)).toBe(queued);
  });

  it("given a receipt stored for tenant A, when tenant B reads, then tenant A stays hidden", async () => {
    const subject = await open();
    const transfer = dispatched();
    await subject.transfers.save(TENANT_A, transfer);
    await seedStock(subject);

    await subject.transfers.receive(TENANT_A, receiptOf(transfer));

    expect(await subject.transfers.find(TENANT_B, TRANSFER_ID)).toBeNull();
    expect(await subject.movements(TENANT_B)).toEqual([]);
    expect(await subject.balance(TENANT_B, DESTINATION_ID, BEEF_ID)).toBe(0);
    expect(await subject.averageCost(TENANT_B, DESTINATION_ID, BEEF_ID)).toBe(
      0,
    );
    expect((await subject.transfers.find(TENANT_A, TRANSFER_ID))?.status).toBe(
      TRANSFER_STATUS.RECEIVED,
    );
    expect(await subject.balance(TENANT_A, DESTINATION_ID, BEEF_ID)).toBe(
      DESTINATION_ON_HAND + BEEF_QUANTITY,
    );
  });

  it("given an in-transit transfer and a stored average, when the next insert fails, then the movements, status, and average cost roll back", async () => {
    const subject = await open();
    const transfer = dispatched();
    await subject.transfers.save(TENANT_A, transfer);
    await seedStock(subject);
    const balance = await subject.balance(TENANT_A, DESTINATION_ID, BEEF_ID);
    const average = await subject.averageCost(
      TENANT_A,
      DESTINATION_ID,
      BEEF_ID,
    );
    const originBalance = await subject.balance(TENANT_A, ORIGIN_ID, BEEF_ID);
    const originAverage = await subject.averageCost(
      TENANT_A,
      ORIGIN_ID,
      BEEF_ID,
    );
    const movements = await subject.movements(TENANT_A);

    expect(balance).toBe(DESTINATION_ON_HAND);
    expect(average).toBe(DESTINATION_AVERAGE);
    subject.failOnInsert(1);

    await expect(
      subject.transfers.receive(TENANT_A, receiptOf(transfer)),
    ).rejects.toThrow();
    const stored = await subject.transfers.find(TENANT_A, TRANSFER_ID);

    expect(stored?.status).toBe(TRANSFER_STATUS.IN_TRANSIT);
    expect(stored?.lines).toEqual([
      {
        ingredientId: BEEF_ID,
        quantity: BEEF_QUANTITY,
        unitCost: ORIGIN_AVERAGE,
      },
    ]);
    expect(await subject.balance(TENANT_A, DESTINATION_ID, BEEF_ID)).toBe(
      balance,
    );
    expect(await subject.averageCost(TENANT_A, DESTINATION_ID, BEEF_ID)).toBe(
      average,
    );
    expect(await subject.balance(TENANT_A, ORIGIN_ID, BEEF_ID)).toBe(
      originBalance,
    );
    expect(await subject.averageCost(TENANT_A, ORIGIN_ID, BEEF_ID)).toBe(
      originAverage,
    );
    expect(await subject.movements(TENANT_A)).toEqual(movements);
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });
}
