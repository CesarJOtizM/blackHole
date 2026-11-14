import { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import {
  type AppendStock,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  type StockMovementEnvelope,
  StockMovementQueue,
  stockMovedEvent,
} from "#application/ports/stock-movement-queue.js";
import { type MOVEMENT_TYPE, onHandDelta } from "#domain/stock-ledger.js";

const INSERT_FAILED = "The stock movement insert failed.";
const RECEIPT_FAILED = "The purchase receipt insert failed.";

export interface PostedPurchase {
  id: string;
  tenantId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: typeof MOVEMENT_TYPE.PURCHASE;
  reference: string;
  occurredAt: string;
  actorId: string;
  orderLineId: null;
  role: null;
  recipeVersion: null;
}

interface PurchasePosting {
  movement: PostedPurchase;
  averageCost: number;
}

interface LedgerSnapshot {
  movements: LedgerLine[];
  balances: Map<string, number>;
  alerts: NegativeStockOpenedEvent[];
  queue: StockMovementEnvelope[];
  purchases: PostedPurchase[];
  averages: Map<string, number>;
}

const balanceKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const venueKey = (tenantId: string, venueId: string): string =>
  `${tenantId}\u0000${venueId}`;

const copyLine = (line: LedgerLine): LedgerLine => ({ ...line });

const copyAlert = (
  alert: NegativeStockOpenedEvent,
): NegativeStockOpenedEvent => ({ ...alert });

const copyEnvelope = (
  envelope: StockMovementEnvelope,
): StockMovementEnvelope => ({
  lane: envelope.lane,
  key: envelope.key,
  event: { ...envelope.event },
});

const sameLine = (left: LedgerLine, right: LedgerLine): boolean =>
  left.tenantId === right.tenantId &&
  left.orderLineId === right.orderLineId &&
  left.role === right.role &&
  left.ingredientId === right.ingredientId;

export class InMemoryStockLedgerRepository extends StockLedgerRepository {
  private movements: LedgerLine[] = [];
  private readonly balances = new Map<string, number>();
  private alerts: NegativeStockOpenedEvent[] = [];
  private queue: StockMovementEnvelope[] = [];
  private purchases: PostedPurchase[] = [];
  private readonly averages = new Map<string, number>();
  private failAt: number | null = null;

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  override async findLine(
    tenantId: string,
    orderLineId: string,
    role: LedgerLine["role"],
  ): Promise<readonly LedgerLine[]> {
    return this.movements
      .filter(
        (line) =>
          line.tenantId === tenantId &&
          line.orderLineId === orderLineId &&
          line.role === role,
      )
      .map(copyLine);
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.balances.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  override async hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean> {
    return this.alerts.some(
      (alert) =>
        alert.tenantId === tenantId &&
        alert.locationId === locationId &&
        alert.ingredientId === ingredientId,
    );
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerLine[]> {
    return this.movements
      .filter((line) => line.tenantId === tenantId && line.venueId === venueId)
      .map(copyLine);
  }

  override async append(input: AppendStock): Promise<void> {
    const snapshot = this.capture();
    const failAt = this.failAt;
    this.failAt = null;

    try {
      for (const [index, movement] of input.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(INSERT_FAILED);
        }

        this.insertMovement(movement);
      }

      for (const alert of input.alerts) {
        this.insertAlert(alert);
      }
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  purchaseAverage(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): number {
    return (
      this.averages.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  postedPurchases(tenantId: string): readonly PostedPurchase[] {
    return this.purchases
      .filter((movement) => movement.tenantId === tenantId)
      .map((movement) => ({ ...movement }));
  }

  // Purchases share the balance map and skip the after_sales queue.
  postPurchases(
    postings: readonly PurchasePosting[],
    failAt: number | null,
  ): void {
    const snapshot = this.capture();

    try {
      for (const [index, posting] of postings.entries()) {
        if (failAt === index + 1) {
          throw new Error(RECEIPT_FAILED);
        }

        this.insertPurchase(posting);
      }
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  async queued(tenantId: string): Promise<readonly StockMovementEnvelope[]> {
    return this.queue
      .filter((envelope) => envelope.event.tenantId === tenantId)
      .map(copyEnvelope);
  }

  async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    if (envelope.lane !== STOCK_MOVEMENT_LANE) {
      throw new Error("Stock movements queue on the after_sales lane.");
    }

    if (envelope.key !== envelope.event.movementId) {
      throw new Error("The stock movement queue key is the movement id.");
    }

    const stored = this.queue.some(
      (row) =>
        row.event.tenantId === envelope.event.tenantId &&
        row.key === envelope.key,
    );

    if (stored) {
      return;
    }

    this.queue.push(copyEnvelope(envelope));
  }

  private insertMovement(movement: LedgerLine): void {
    if (
      this.movements.some(
        (stored) =>
          stored.tenantId === movement.tenantId && stored.id === movement.id,
      )
    ) {
      throw new Error("That stock movement was already stored.");
    }

    if (this.movements.some((stored) => sameLine(stored, movement))) {
      throw new Error(
        "That order line already records this ingredient for the role.",
      );
    }

    const delta = onHandDelta(movement, this.movements);
    this.movements.push(copyLine(movement));
    const key = balanceKey(
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    this.balances.set(key, (this.balances.get(key) ?? 0) + delta);
    this.queue.push({
      lane: STOCK_MOVEMENT_LANE,
      key: movement.id,
      event: stockMovedEvent(movement),
    });
  }

  private insertPurchase(posting: PurchasePosting): void {
    const movement = posting.movement;

    if (
      this.purchases.some(
        (stored) =>
          stored.tenantId === movement.tenantId && stored.id === movement.id,
      ) ||
      this.movements.some(
        (stored) =>
          stored.tenantId === movement.tenantId && stored.id === movement.id,
      )
    ) {
      throw new Error("That stock movement was already stored.");
    }

    const key = balanceKey(
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    this.purchases.push({ ...movement });
    this.balances.set(key, (this.balances.get(key) ?? 0) + movement.quantity);
    this.averages.set(key, posting.averageCost);
  }

  private insertAlert(alert: NegativeStockOpenedEvent): void {
    const open = this.alerts.some(
      (stored) =>
        stored.tenantId === alert.tenantId &&
        stored.locationId === alert.locationId &&
        stored.ingredientId === alert.ingredientId,
    );

    if (open) {
      throw new Error("That negative stock alert is already open.");
    }

    this.alerts.push(copyAlert(alert));
  }

  private capture(): LedgerSnapshot {
    return {
      movements: this.movements.map(copyLine),
      balances: new Map(this.balances),
      alerts: this.alerts.map(copyAlert),
      queue: this.queue.map(copyEnvelope),
      purchases: this.purchases.map((movement) => ({ ...movement })),
      averages: new Map(this.averages),
    };
  }

  private restore(snapshot: LedgerSnapshot): void {
    this.movements = snapshot.movements;
    this.alerts = snapshot.alerts;
    this.queue = snapshot.queue;
    this.purchases = snapshot.purchases;
    this.balances.clear();
    this.averages.clear();

    for (const [key, quantity] of snapshot.balances) {
      this.balances.set(key, quantity);
    }

    for (const [key, average] of snapshot.averages) {
      this.averages.set(key, average);
    }
  }
}

export class InMemoryStockMovementQueue extends StockMovementQueue {
  constructor(private readonly ledger: InMemoryStockLedgerRepository) {
    super();
  }

  override async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    await this.ledger.enqueue(envelope);
  }
}

export class InMemoryPointOfSaleDirectory extends PointOfSaleDirectory {
  private readonly locations = new Map<string, string>();

  remember(tenantId: string, venueId: string, locationId: string): void {
    const key = venueKey(tenantId, venueId);

    if (this.locations.has(key)) {
      throw new Error("That venue already has a point-of-sale location.");
    }

    this.locations.set(key, locationId);
  }

  override async locationOf(
    tenantId: string,
    venueId: string,
  ): Promise<string> {
    const locationId = this.locations.get(venueKey(tenantId, venueId));

    if (locationId === undefined) {
      throw new Error("The venue has no point-of-sale location.");
    }

    return locationId;
  }
}
