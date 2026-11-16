import { expect, it } from "vitest";
import {
  InMemoryIngredientClassification,
  InMemoryStockCountRepository,
} from "#adapters/memory/in-memory-stock-count-repository.js";
import type { IngredientClassification } from "#application/ports/ingredient-classification.js";
import {
  COUNT_LINE_ROLE,
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountSession,
  type StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";
const BEEF_ID = "ingredient_beef";
const ACTOR_ID = "user_kitchen_chief";
const CUT_OFF = "2026-11-13T18:00:00.000Z";
const BEFORE = "2026-11-13T17:00:00.000Z";
const AFTER = "2026-11-13T19:00:00.000Z";
const AVERAGE_COST = 1_500;
const DAIRY = "dairy";
const MEAT = "meat";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

export interface StockCountContractSubject {
  repository: StockCountRepository;
  classifications: IngredientClassification;
  knowIngredient(tenantId: string, ingredientId: string): void;
  session(tenantId: string, documentId: string): Promise<CountSession | null>;
  stock(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
  seed(line: CountLedgerLine): Promise<void>;
  reject(tenantId: string, documentId: string): Promise<void>;
}

const ledgerLine = (
  input: Pick<
    CountLedgerLine,
    "id" | "tenantId" | "ingredientId" | "quantity" | "occurredAt"
  > &
    Partial<CountLedgerLine>,
): CountLedgerLine => ({
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  unitCost: AVERAGE_COST,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: input.id,
  orderLineId: input.id,
  role: COUNT_LINE_ROLE.CONSUMPTION,
  recipeVersion: 0,
  reason: null,
  actorId: null,
  ...input,
});

const frozenSession = (
  tenantId: string,
  documentId: string,
  status: CountSession["status"],
  quantity: number,
  valueCop: number,
): CountSession => ({
  tenantId,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  documentId,
  cutOff: CUT_OFF,
  status,
  lines: [
    {
      ingredientId: MILK_ID,
      quantity,
      averageCost: AVERAGE_COST,
      valueCop,
    },
  ],
  valueCop,
});

export function stockCountRepositoryContract(
  open: () => StockCountContractSubject | Promise<StockCountContractSubject>,
): void {
  it("given a frozen milk shortage of 600 g at 1500 COP, when the session and its line are stored, then location, ingredient, quantity, and average cost still match after a later sale", async () => {
    const subject = await open();
    const documentId = "count_milk_within_cap";
    const session = frozenSession(
      TENANT_A,
      documentId,
      COUNT_SESSION_STATUS.POSTED,
      grams(-600),
      900,
    );
    const adjustment = ledgerLine({
      id: `movement_${documentId}_${MILK_ID}`,
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      quantity: grams(-600),
      occurredAt: CUT_OFF,
      type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      reference: documentId,
      orderLineId: documentId,
      role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
      actorId: ACTOR_ID,
    });
    const laterSale = ledgerLine({
      id: "movement_milk_sale_after",
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      quantity: grams(-200),
      occurredAt: AFTER,
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      role: COUNT_LINE_ROLE.CONSUMPTION,
    });

    await subject.repository.saveSession(session);
    await subject.repository.appendAdjustments([adjustment]);
    await subject.seed(laterSale);

    const stored = await subject.session(TENANT_A, documentId);
    const lines = await subject.repository.movementsAt(
      TENANT_A,
      VENUE_ID,
      LOCATION_ID,
    );
    const posted = lines.find((line) => line.id === adjustment.id);

    expect(stored).toEqual(session);
    expect(stored?.locationId).toBe(LOCATION_ID);
    expect(stored?.lines[0]).toEqual({
      ingredientId: MILK_ID,
      quantity: grams(-600),
      averageCost: AVERAGE_COST,
      valueCop: 900,
    });
    expect(posted).toEqual(adjustment);
    expect(posted?.unitCost).toBe(AVERAGE_COST);
    expect(lines).toEqual([adjustment, laterSale]);
  });

  it("given tenant A stored a session, a line, and a dairy classification, when tenant B reads them, then those rows stay hidden", async () => {
    const subject = await open();
    const documentId = "count_milk_shared_document";
    const sessionA = frozenSession(
      TENANT_A,
      documentId,
      COUNT_SESSION_STATUS.POSTED,
      grams(-600),
      900,
    );
    const sessionB = frozenSession(
      TENANT_B,
      documentId,
      COUNT_SESSION_STATUS.PENDING,
      grams(-100),
      150,
    );
    const lineA = ledgerLine({
      id: "movement_tenant_a",
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      quantity: grams(8000),
      occurredAt: BEFORE,
    });
    const lineB = ledgerLine({
      id: "movement_tenant_b",
      tenantId: TENANT_B,
      ingredientId: BEEF_ID,
      quantity: grams(500),
      occurredAt: BEFORE,
    });

    subject.knowIngredient(TENANT_A, MILK_ID);
    await subject.classifications.save({
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      category: DAIRY,
    });
    await subject.repository.saveSession(sessionA);
    await subject.seed(lineA);
    subject.knowIngredient(TENANT_B, BEEF_ID);
    await subject.classifications.save({
      tenantId: TENANT_B,
      ingredientId: BEEF_ID,
      category: MEAT,
    });
    await subject.repository.saveSession(sessionB);
    await subject.seed(lineB);

    expect(await subject.session(TENANT_B, documentId)).toEqual(sessionB);
    expect(await subject.session(TENANT_A, documentId)).toEqual(sessionA);
    expect(
      await subject.repository.movementsAt(TENANT_A, VENUE_ID, LOCATION_ID),
    ).toEqual([lineA]);
    expect(
      await subject.repository.movementsAt(TENANT_B, VENUE_ID, LOCATION_ID),
    ).toEqual([lineB]);
    expect(await subject.classifications.find(TENANT_B, MILK_ID)).toBeNull();
    expect(
      await subject.classifications.ingredientOf(TENANT_B, MILK_ID),
    ).toBeNull();
    expect(await subject.classifications.find(TENANT_A, MILK_ID)).toEqual({
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      category: DAIRY,
    });
    expect(await subject.classifications.find(TENANT_A, BEEF_ID)).toBeNull();
    expect(
      await subject.classifications.ingredientOf(TENANT_A, BEEF_ID),
    ).toBeNull();
    expect(await subject.classifications.find(TENANT_B, BEEF_ID)).toEqual({
      tenantId: TENANT_B,
      ingredientId: BEEF_ID,
      category: MEAT,
    });
    expect(await subject.stock(TENANT_A, LOCATION_ID, MILK_ID)).toBe(
      grams(8000),
    );
    expect(await subject.stock(TENANT_B, LOCATION_ID, MILK_ID)).toBe(0);
  });

  it("given 8000 g on hand and a pending count, when that count is rejected, then the freeze stays and stock is unchanged", async () => {
    const subject = await open();
    const documentId = "count_milk_rejected";
    const opening = ledgerLine({
      id: "movement_milk_opening",
      tenantId: TENANT_A,
      ingredientId: MILK_ID,
      quantity: grams(8000),
      occurredAt: BEFORE,
    });
    const session = frozenSession(
      TENANT_A,
      documentId,
      COUNT_SESSION_STATUS.PENDING,
      grams(-600),
      900,
    );

    await subject.seed(opening);
    await subject.repository.saveSession(session);
    const stockBefore = await subject.stock(TENANT_A, LOCATION_ID, MILK_ID);
    const linesBefore = await subject.repository.movementsAt(
      TENANT_A,
      VENUE_ID,
      LOCATION_ID,
    );

    await subject.reject(TENANT_A, documentId);
    await subject.reject(TENANT_B, documentId);

    expect(stockBefore).toBe(grams(8000));
    expect(await subject.stock(TENANT_A, LOCATION_ID, MILK_ID)).toBe(
      stockBefore,
    );
    expect(
      await subject.repository.movementsAt(TENANT_A, VENUE_ID, LOCATION_ID),
    ).toEqual(linesBefore);
    expect(
      linesBefore.some(
        (line) => line.role === COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
      ),
    ).toBe(false);
    expect(await subject.session(TENANT_A, documentId)).toEqual(session);
    expect(await subject.session(TENANT_B, documentId)).toBeNull();
  });
}

const testPath = (expect.getState().testPath ?? "").replaceAll("\\", "/");
const importedByPostgresContract = testPath.endsWith(
  "drizzle-stock-count-repository.contract.test.ts",
);

if (!importedByPostgresContract) {
  stockCountRepositoryContract(() => {
    const repository = new InMemoryStockCountRepository();
    const classifications = new InMemoryIngredientClassification();

    return {
      repository,
      classifications,
      knowIngredient: (tenantId, ingredientId) => {
        classifications.know(tenantId, ingredientId);
      },
      session: (tenantId, documentId) =>
        repository.sessionOf(tenantId, documentId),
      stock: (tenantId, locationId, ingredientId) =>
        repository.stockOf(tenantId, locationId, ingredientId),
      seed: (line) => repository.seed(line),
      reject: (tenantId, documentId) => repository.reject(tenantId, documentId),
    };
  });
}
