export const MOVEMENT_TYPE = {
  PURCHASE: "purchase",
  SALE_CONSUMPTION: "sale_consumption",
  SALE_RETURN: "sale_return",
  WASTE: "waste",
  PRODUCTION_CONSUMPTION: "production_consumption",
  PRODUCTION_OUTPUT: "production_output",
  TRANSFER_OUT: "transfer_out",
  TRANSFER_IN: "transfer_in",
  COUNT_ADJUSTMENT: "count_adjustment",
} as const;

export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];

const WRITABLE_MOVEMENT_TYPES: ReadonlySet<string> = new Set([
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.SALE_CONSUMPTION,
  MOVEMENT_TYPE.SALE_RETURN,
  MOVEMENT_TYPE.WASTE,
  MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
  MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  MOVEMENT_TYPE.TRANSFER_OUT,
  MOVEMENT_TYPE.TRANSFER_IN,
  MOVEMENT_TYPE.COUNT_ADJUSTMENT,
]);

export interface StockMovement {
  id: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: MovementType;
  reference: string;
  occurredAt: string;
  reversesMovementId?: string;
}

interface OpenLedger {
  tenantId: string;
  locationId: string;
}

interface AppendMovement {
  id: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: MovementType;
  reference: string;
  occurredAt: string;
  reversesMovementId?: string;
}

interface OnHandMovement {
  id: string;
  type: MovementType;
  ingredientId: string;
  quantity: number;
  reversesMovementId?: string;
}

// A waste line that points at a sale consumption does not move on-hand.
// That consumption already deducted the ingredient. Standalone waste still does.
export function onHandDelta(
  movement: OnHandMovement,
  prior: readonly OnHandMovement[],
): number {
  const alreadyDeducted =
    movement.type === MOVEMENT_TYPE.WASTE &&
    movement.reversesMovementId !== undefined &&
    prior.some(
      (item) =>
        item.id === movement.reversesMovementId &&
        item.type === MOVEMENT_TYPE.SALE_CONSUMPTION &&
        item.ingredientId === movement.ingredientId,
    );

  return alreadyDeducted ? 0 : movement.quantity;
}

interface AverageCostInput {
  onHand: number;
  averageCost: number;
  receivedQuantity: number;
  receiptCost: number;
}

// Whole COP per base unit. A negative or empty balance takes the receipt cost.
// Callers are purchase, transfer_in, and a positive production_output.
export function nextAverageCost(input: AverageCostInput): number {
  if (
    !Number.isInteger(input.receivedQuantity) ||
    input.receivedQuantity <= 0 ||
    !Number.isInteger(input.onHand)
  ) {
    throw new InvalidQuantity();
  }

  if (
    !Number.isInteger(input.receiptCost) ||
    input.receiptCost < 0 ||
    !Number.isInteger(input.averageCost) ||
    input.averageCost < 0
  ) {
    throw new InvalidUnitCost();
  }

  if (input.onHand <= 0) {
    return input.receiptCost;
  }

  return roundHalfUp(
    input.onHand * input.averageCost +
      input.receivedQuantity * input.receiptCost,
    input.onHand + input.receivedQuantity,
  );
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

interface ReverseMovement {
  id: string;
  movementId: string;
  reference: string;
  occurredAt: string;
}

interface MovementPatch {
  quantity?: number;
  unitCost?: number;
  type?: MovementType;
  reference?: string;
  occurredAt?: string;
}

export class MovementImmutable extends Error {
  constructor() {
    super("A stock movement cannot be changed or deleted.");
    this.name = "MovementImmutable";
  }
}

export class MovementAlreadyReversed extends Error {
  constructor() {
    super("A sale consumption can be reversed only once.");
    this.name = "MovementAlreadyReversed";
  }
}

export class MovementTypeNotWritable extends Error {
  readonly movementType: string;

  constructor(movementType: string) {
    super(`Movement type ${movementType} cannot be appended.`);
    this.name = "MovementTypeNotWritable";
    this.movementType = movementType;
  }
}

export class UnknownMovement extends Error {
  constructor() {
    super("The ledger does not contain that movement.");
    this.name = "UnknownMovement";
  }
}

export class DuplicateMovement extends Error {
  constructor() {
    super("A stock movement identifier is already in the ledger.");
    this.name = "DuplicateMovement";
  }
}

export class InvalidQuantity extends Error {
  constructor() {
    super("A quantity must be a whole number of base units.");
    this.name = "InvalidQuantity";
  }
}

export class InvalidUnitCost extends Error {
  constructor() {
    super("A unit cost must be a whole number of COP.");
    this.name = "InvalidUnitCost";
  }
}

function assertWritable(type: MovementType): void {
  if (!WRITABLE_MOVEMENT_TYPES.has(type)) {
    throw new MovementTypeNotWritable(type);
  }
}

function assertQuantity(type: MovementType, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new InvalidQuantity();
  }

  const decreases =
    type === MOVEMENT_TYPE.SALE_CONSUMPTION ||
    type === MOVEMENT_TYPE.WASTE ||
    type === MOVEMENT_TYPE.PRODUCTION_CONSUMPTION ||
    type === MOVEMENT_TYPE.TRANSFER_OUT;

  if (decreases && quantity > 0) {
    throw new InvalidQuantity();
  }

  if (type === MOVEMENT_TYPE.SALE_RETURN && quantity < 0) {
    throw new InvalidQuantity();
  }

  if (type === MOVEMENT_TYPE.PURCHASE && quantity < 0) {
    throw new InvalidQuantity();
  }

  if (type === MOVEMENT_TYPE.TRANSFER_IN && quantity < 0) {
    throw new InvalidQuantity();
  }

  if (type === MOVEMENT_TYPE.PRODUCTION_OUTPUT && quantity < 0) {
    throw new InvalidQuantity();
  }
}

function assertUnitCost(unitCost: number): void {
  if (!Number.isInteger(unitCost) || unitCost < 0) {
    throw new InvalidUnitCost();
  }
}

function copyMovement(movement: StockMovement): StockMovement {
  return { ...movement };
}

export class StockLedger {
  readonly tenantId: string;
  readonly locationId: string;

  private readonly stored: StockMovement[] = [];
  private readonly reversedIds = new Set<string>();

  private constructor(tenantId: string, locationId: string) {
    this.tenantId = tenantId;
    this.locationId = locationId;
  }

  static open(input: OpenLedger): StockLedger {
    return new StockLedger(input.tenantId, input.locationId);
  }

  get movements(): readonly StockMovement[] {
    return this.stored.map(copyMovement);
  }

  balance(ingredientId: string): number {
    return this.replay(ingredientId).onHand;
  }

  balanceUntil(ingredientId: string, occurredAt: string): number {
    return this.replay(ingredientId, occurredAt).onHand;
  }

  averageCost(ingredientId: string): number {
    return this.replay(ingredientId).average;
  }

  averageCostUntil(ingredientId: string, occurredAt: string): number {
    return this.replay(ingredientId, occurredAt).average;
  }

  private replay(
    ingredientId: string,
    occurredAt?: string,
  ): { onHand: number; average: number } {
    let onHand = 0;
    let average = 0;
    const prior: StockMovement[] = [];

    for (const movement of this.stored) {
      if (occurredAt !== undefined && movement.occurredAt > occurredAt) {
        continue;
      }

      if (movement.ingredientId === ingredientId) {
        if (
          movement.type === MOVEMENT_TYPE.PURCHASE ||
          movement.type === MOVEMENT_TYPE.TRANSFER_IN ||
          (movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT &&
            movement.quantity > 0)
        ) {
          average = nextAverageCost({
            onHand,
            averageCost: average,
            receivedQuantity: movement.quantity,
            receiptCost: movement.unitCost,
          });
        }

        onHand += onHandDelta(movement, prior);
      }

      prior.push(movement);
    }

    return { onHand, average };
  }

  append(input: AppendMovement): void {
    assertWritable(input.type);
    assertQuantity(input.type, input.quantity);
    assertUnitCost(input.unitCost);
    this.assertNewId(input.id);

    this.stored.push({
      id: input.id,
      locationId: this.locationId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unitCost: input.unitCost,
      type: input.type,
      reference: input.reference,
      occurredAt: input.occurredAt,
      ...(input.reversesMovementId === undefined
        ? {}
        : { reversesMovementId: input.reversesMovementId }),
    });
  }

  reverse(input: ReverseMovement): void {
    const original = this.movement(input.movementId);

    if (
      original.type !== MOVEMENT_TYPE.SALE_CONSUMPTION ||
      this.reversedIds.has(original.id)
    ) {
      throw new MovementAlreadyReversed();
    }

    this.assertNewId(input.id);
    this.stored.push({
      id: input.id,
      locationId: original.locationId,
      ingredientId: original.ingredientId,
      quantity: -original.quantity,
      unitCost: original.unitCost,
      type: MOVEMENT_TYPE.SALE_RETURN,
      reference: input.reference,
      occurredAt: input.occurredAt,
      reversesMovementId: original.id,
    });
    this.reversedIds.add(original.id);
  }

  change(movementId: string, patch: MovementPatch): void {
    this.movement(movementId);

    if (
      patch.quantity !== undefined ||
      patch.unitCost !== undefined ||
      patch.type !== undefined ||
      patch.reference !== undefined ||
      patch.occurredAt !== undefined
    ) {
      throw new MovementImmutable();
    }

    throw new MovementImmutable();
  }

  delete(movementId: string): void {
    this.movement(movementId);
    throw new MovementImmutable();
  }

  private movement(movementId: string): StockMovement {
    const found = this.stored.find((item) => item.id === movementId);

    if (!found) {
      throw new UnknownMovement();
    }

    return found;
  }

  private assertNewId(id: string): void {
    if (this.stored.some((item) => item.id === id)) {
      throw new DuplicateMovement();
    }
  }
}
