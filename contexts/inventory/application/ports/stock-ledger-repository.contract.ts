import { expect, it } from "vitest";

import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import {
  CONSUMPTION_ROLE,
  type ConsumptionRole,
  type LedgerLine,
  type StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  type StockMovementEnvelope,
  stockMovedEvent,
} from "#application/ports/stock-movement-queue.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, type MovementType } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const ONION_ID = "ingredient_onion";
const CHEESE_ID = "ingredient_cheese";
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";
const UNIT_COST = 1_500;
const INSERT_FAILED = "The stock movement insert failed.";

export interface StockLedgerContractSubject {
  repository: StockLedgerRepository;
  failOnInsert(ordinal: number): void;
  queued(tenantId: string): Promise<readonly StockMovementEnvelope[]>;
}

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const line = (input: {
  id: string;
  tenantId?: string;
  ingredientId?: string;
  quantity: number;
  type: MovementType;
  orderLineId: string;
  role: ConsumptionRole;
  reversesMovementId?: string;
}): LedgerLine => ({
  id: input.id,
  tenantId: input.tenantId ?? TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: input.ingredientId ?? BEEF_ID,
  quantity: input.quantity,
  unitCost: UNIT_COST,
  type: input.type,
  reference: input.orderLineId,
  occurredAt: OCCURRED_AT,
  orderLineId: input.orderLineId,
  role: input.role,
  recipeVersion: 4,
  reason: null,
  actorId: null,
  ...(input.reversesMovementId === undefined
    ? {}
    : { reversesMovementId: input.reversesMovementId }),
});

const negativeAlert = (
  ingredientId: string,
  balance: number,
): NegativeStockOpenedEvent => ({
  type: "NegativeStockOpened",
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId,
  balance,
  occurredAt: OCCURRED_AT,
});

const envelope = (movement: LedgerLine): StockMovementEnvelope => ({
  lane: STOCK_MOVEMENT_LANE,
  key: movement.id,
  event: stockMovedEvent(movement),
});

export function stockLedgerRepositoryContract(
  open: () => StockLedgerContractSubject | Promise<StockLedgerContractSubject>,
): void {
  it("given movements of +1000 g, -700 g, and -500 g, when the balance is read, then it is -200 g and each movement is queued", async () => {
    const { repository, queued } = await open();
    const received = line({
      id: "movement_received",
      quantity: grams(1000),
      type: MOVEMENT_TYPE.SALE_RETURN,
      orderLineId: "line_received",
      role: CONSUMPTION_ROLE.REVERSAL,
    });
    const lunch = line({
      id: "movement_lunch",
      quantity: grams(-700),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_lunch",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const dinner = line({
      id: "movement_dinner",
      quantity: grams(-500),
      type: MOVEMENT_TYPE.WASTE,
      orderLineId: "line_dinner",
      role: CONSUMPTION_ROLE.REVERSAL,
      reversesMovementId: "movement_dinner_source",
    });
    const alert = negativeAlert(BEEF_ID, grams(-200));

    await repository.append({
      movements: [received, lunch, dinner],
      alerts: [alert],
    });

    expect(await repository.balance(TENANT_A, LOCATION_ID, BEEF_ID)).toBe(
      grams(-200),
    );
    expect(
      await repository.findLine(
        TENANT_A,
        "line_lunch",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([lunch]);
    expect(
      await repository.findLine(
        TENANT_A,
        "line_dinner",
        CONSUMPTION_ROLE.REVERSAL,
      ),
    ).toEqual([dinner]);
    expect(await repository.hasOpenAlert(TENANT_A, LOCATION_ID, BEEF_ID)).toBe(
      true,
    );
    expect(await repository.hasOpenAlert(TENANT_A, LOCATION_ID, ONION_ID)).toBe(
      false,
    );
    expect(await queued(TENANT_A)).toEqual([
      envelope(received),
      envelope(lunch),
      envelope(dinner),
    ]);
  });

  it("given the same order line and two ingredients, when that ingredient is appended again, then the balance stays", async () => {
    const { repository, queued } = await open();
    const onion = line({
      id: "movement_onion",
      ingredientId: ONION_ID,
      quantity: grams(-150),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_burger",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const cheese = line({
      id: "movement_cheese",
      ingredientId: CHEESE_ID,
      quantity: grams(-30),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_burger",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const retry = line({
      id: "movement_onion_retry",
      ingredientId: ONION_ID,
      quantity: grams(-150),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_burger",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });

    await repository.append({ movements: [onion, cheese], alerts: [] });

    await expect(
      repository.append({ movements: [retry], alerts: [] }),
    ).rejects.toThrow();
    expect(await repository.balance(TENANT_A, LOCATION_ID, ONION_ID)).toBe(
      grams(-150),
    );
    expect(await repository.balance(TENANT_A, LOCATION_ID, CHEESE_ID)).toBe(
      grams(-30),
    );
    expect(
      await repository.findLine(
        TENANT_A,
        "line_burger",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([onion, cheese]);
    expect(await queued(TENANT_A)).toEqual([envelope(onion), envelope(cheese)]);
  });

  it("given tenants A and B, when tenant A reads its balance, then B stays hidden", async () => {
    const { repository, queued } = await open();
    const lineA = line({
      id: "movement_tenant_a",
      tenantId: TENANT_A,
      quantity: grams(-200),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_tenant_a",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const lineB = line({
      id: "movement_tenant_b",
      tenantId: TENANT_B,
      quantity: grams(-500),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_tenant_b",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });

    await repository.append({ movements: [lineA], alerts: [] });
    await repository.append({ movements: [lineB], alerts: [] });

    expect(await repository.balance(TENANT_A, LOCATION_ID, BEEF_ID)).toBe(
      grams(-200),
    );
    expect(await repository.balance(TENANT_B, LOCATION_ID, BEEF_ID)).toBe(
      grams(-500),
    );
    expect(
      await repository.findLine(
        TENANT_A,
        "line_tenant_a",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([lineA]);
    expect(
      await repository.findLine(
        TENANT_A,
        "line_tenant_b",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([]);
    expect(
      await repository.findLine(
        TENANT_B,
        "line_tenant_b",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([lineB]);
    expect(
      await repository.findLine(
        TENANT_B,
        "line_tenant_a",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([]);
    expect(await queued(TENANT_A)).toEqual([envelope(lineA)]);
    expect(await queued(TENANT_B)).toEqual([envelope(lineB)]);
  });

  it("given a consumption of three ingredients, when the third insert fails, then movements, balance, alert, and the queued row roll back", async () => {
    const { repository, failOnInsert, queued } = await open();
    const existing = line({
      id: "movement_existing",
      quantity: grams(1000),
      type: MOVEMENT_TYPE.SALE_RETURN,
      orderLineId: "line_existing",
      role: CONSUMPTION_ROLE.REVERSAL,
    });
    const onion = line({
      id: "movement_batch_onion",
      ingredientId: ONION_ID,
      quantity: grams(-100),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_batch",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const cheese = line({
      id: "movement_batch_cheese",
      ingredientId: CHEESE_ID,
      quantity: grams(-200),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_batch",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });
    const beef = line({
      id: "movement_batch_beef",
      ingredientId: BEEF_ID,
      quantity: grams(-300),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      orderLineId: "line_batch",
      role: CONSUMPTION_ROLE.CONSUMPTION,
    });

    await repository.append({ movements: [existing], alerts: [] });
    failOnInsert(3);

    await expect(
      repository.append({
        movements: [onion, cheese, beef],
        alerts: [negativeAlert(BEEF_ID, grams(-300))],
      }),
    ).rejects.toThrow(INSERT_FAILED);
    expect(await repository.balance(TENANT_A, LOCATION_ID, ONION_ID)).toBe(0);
    expect(await repository.balance(TENANT_A, LOCATION_ID, CHEESE_ID)).toBe(0);
    expect(await repository.balance(TENANT_A, LOCATION_ID, BEEF_ID)).toBe(
      grams(1000),
    );
    expect(
      await repository.findLine(
        TENANT_A,
        "line_batch",
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ).toEqual([]);
    expect(await repository.hasOpenAlert(TENANT_A, LOCATION_ID, BEEF_ID)).toBe(
      false,
    );
    expect(await queued(TENANT_A)).toEqual([envelope(existing)]);
  });
}
