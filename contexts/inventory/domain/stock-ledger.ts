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
  MOVEMENT_TYPE.SALE_CONSUMPTION,
  MOVEMENT_TYPE.SALE_RETURN,
  MOVEMENT_TYPE.WASTE,
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
    type === MOVEMENT_TYPE.SALE_CONSUMPTION || type === MOVEMENT_TYPE.WASTE;

  if (decreases && quantity > 0) {
    throw new InvalidQuantity();
  }

  if (type === MOVEMENT_TYPE.SALE_RETURN && quantity < 0) {
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
    let total = 0;

    for (const movement of this.stored) {
      if (movement.ingredientId === ingredientId) {
        total += movement.quantity;
      }
    }

    return total;
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
