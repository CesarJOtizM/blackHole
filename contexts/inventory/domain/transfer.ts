import {
  MOVEMENT_TYPE,
  type MovementType,
  nextAverageCost,
} from "#domain/stock-ledger.js";

export const TRANSFER_STATUS = {
  REQUESTED: "requested",
  IN_TRANSIT: "in_transit",
  RECEIVED: "received",
  RECEIVED_WITH_DIFFERENCES: "received_with_differences",
} as const;

export type TransferStatus =
  (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export class InvalidTransfer extends Error {
  constructor() {
    super("A transfer quantity, cost, and identity must be whole and present.");
    this.name = "InvalidTransfer";
  }
}

export class InsufficientOnHand extends Error {
  constructor() {
    super("A dispatch cannot exceed on-hand.");
    this.name = "InsufficientOnHand";
  }
}

export class TransferNotInTransit extends Error {
  constructor() {
    super("A receipt is legal only after dispatch.");
    this.name = "TransferNotInTransit";
  }
}

export interface TransferLineView {
  ingredientId: string;
  quantity: number;
  unitCost?: number;
  receivedQuantity?: number;
  shortfall?: number;
}

export interface TransferMovement {
  ingredientId: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
}

export interface DestinationAverage {
  ingredientId: string;
  averageCost: number;
}

export interface TransferReceipt {
  movements: readonly TransferMovement[];
  averages: readonly DestinationAverage[];
}

export interface ReplenishmentLevels {
  onHand: number;
  minimum: number;
  maximum: number;
}

interface TransferLineInput {
  ingredientId: string;
  quantity: number;
}

interface RequestTransfer {
  id: string;
  originLocationId: string;
  destinationLocationId: string;
  lines: readonly TransferLineInput[];
}

interface OriginStock {
  ingredientId: string;
  onHand: number;
  averageCost: number;
}

interface DispatchTransfer {
  actorId: string;
  occurredAt: string;
  origin: readonly OriginStock[];
}

interface ReceiveTransferLine {
  ingredientId: string;
  receivedQuantity: number;
  onHand: number;
  averageCost: number;
}

interface ReceiveTransfer {
  actorId: string;
  occurredAt: string;
  lines: readonly ReceiveTransferLine[];
}

interface StoredLine {
  ingredientId: string;
  quantity: number;
  unitCost?: number;
  receivedQuantity?: number;
  shortfall?: number;
}

interface PlannedReceipt {
  ingredientId: string;
  receivedQuantity: number;
  shortfall: number;
  movement?: TransferMovement;
  average?: DestinationAverage;
}

export function suggestReplenishment(
  levels: ReplenishmentLevels,
): number | undefined {
  if (
    !Number.isInteger(levels.onHand) ||
    !Number.isInteger(levels.minimum) ||
    !Number.isInteger(levels.maximum)
  ) {
    throw new InvalidTransfer();
  }

  if (levels.onHand < levels.minimum) {
    return levels.maximum - levels.onHand;
  }

  return undefined;
}

function assertPresent(value: string): void {
  if (value.length === 0) {
    throw new InvalidTransfer();
  }
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidTransfer();
  }
}

function assertUnitCost(unitCost: number): void {
  if (!Number.isInteger(unitCost) || unitCost < 0) {
    throw new InvalidTransfer();
  }
}

function assertOnHand(onHand: number): void {
  if (!Number.isInteger(onHand)) {
    throw new InvalidTransfer();
  }
}

function lineView(line: StoredLine): TransferLineView {
  return {
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    ...(line.unitCost === undefined ? {} : { unitCost: line.unitCost }),
    ...(line.receivedQuantity === undefined
      ? {}
      : { receivedQuantity: line.receivedQuantity }),
    ...(line.shortfall === undefined ? {} : { shortfall: line.shortfall }),
  };
}

export class Transfer {
  readonly id: string;
  readonly originLocationId: string;
  readonly destinationLocationId: string;

  private transferStatus: TransferStatus = TRANSFER_STATUS.REQUESTED;
  private readonly storedLines: StoredLine[];
  private stampedDispatchedAt?: string;
  private stampedInTransitAt?: string;
  private stampedDispatchedBy?: string;
  private stampedReceivedAt?: string;
  private stampedReceivedBy?: string;

  private constructor(
    id: string,
    originLocationId: string,
    destinationLocationId: string,
    lines: StoredLine[],
  ) {
    this.id = id;
    this.originLocationId = originLocationId;
    this.destinationLocationId = destinationLocationId;
    this.storedLines = lines;
  }

  static request(input: RequestTransfer): Transfer {
    assertPresent(input.id);
    assertPresent(input.originLocationId);
    assertPresent(input.destinationLocationId);

    if (input.lines.length === 0) {
      throw new InvalidTransfer();
    }

    const seen = new Set<string>();
    const lines = input.lines.map((line) => {
      assertPresent(line.ingredientId);
      assertPositiveQuantity(line.quantity);

      if (seen.has(line.ingredientId)) {
        throw new InvalidTransfer();
      }

      seen.add(line.ingredientId);

      return {
        ingredientId: line.ingredientId,
        quantity: line.quantity,
      };
    });

    return new Transfer(
      input.id,
      input.originLocationId,
      input.destinationLocationId,
      lines,
    );
  }

  get status(): TransferStatus {
    return this.transferStatus;
  }

  get lines(): readonly TransferLineView[] {
    return this.storedLines.map(lineView);
  }

  get dispatchedAt(): string | undefined {
    return this.stampedDispatchedAt;
  }

  get inTransitAt(): string | undefined {
    return this.stampedInTransitAt;
  }

  get dispatchedBy(): string | undefined {
    return this.stampedDispatchedBy;
  }

  get receivedAt(): string | undefined {
    return this.stampedReceivedAt;
  }

  get receivedBy(): string | undefined {
    return this.stampedReceivedBy;
  }

  dispatch(input: DispatchTransfer): readonly TransferMovement[] {
    if (this.transferStatus !== TRANSFER_STATUS.REQUESTED) {
      throw new InvalidTransfer();
    }

    assertPresent(input.actorId);
    assertPresent(input.occurredAt);

    const movements = this.storedLines.map((line) => {
      const origin = input.origin.find(
        (item) => item.ingredientId === line.ingredientId,
      );

      if (!origin) {
        throw new InsufficientOnHand();
      }

      assertOnHand(origin.onHand);
      assertUnitCost(origin.averageCost);

      if (line.quantity > origin.onHand) {
        throw new InsufficientOnHand();
      }

      return {
        ingredientId: line.ingredientId,
        type: MOVEMENT_TYPE.TRANSFER_OUT,
        quantity: -line.quantity,
        unitCost: origin.averageCost,
      };
    });

    for (const movement of movements) {
      const line = this.storedLines.find(
        (item) => item.ingredientId === movement.ingredientId,
      );

      if (!line) {
        throw new InvalidTransfer();
      }

      line.unitCost = movement.unitCost;
    }

    this.transferStatus = TRANSFER_STATUS.IN_TRANSIT;
    this.stampedDispatchedAt = input.occurredAt;
    this.stampedInTransitAt = input.occurredAt;
    this.stampedDispatchedBy = input.actorId;

    return movements;
  }

  receive(input: ReceiveTransfer): TransferReceipt {
    if (this.transferStatus !== TRANSFER_STATUS.IN_TRANSIT) {
      throw new TransferNotInTransit();
    }

    assertPresent(input.actorId);
    assertPresent(input.occurredAt);

    if (input.lines.length !== this.storedLines.length) {
      throw new InvalidTransfer();
    }

    const planned = this.storedLines.map((line) =>
      this.planReceipt(line, input.lines),
    );

    const movements: TransferMovement[] = [];
    const averages: DestinationAverage[] = [];

    for (const plan of planned) {
      const line = this.storedLines.find(
        (item) => item.ingredientId === plan.ingredientId,
      );

      if (!line) {
        throw new InvalidTransfer();
      }

      line.receivedQuantity = plan.receivedQuantity;
      line.shortfall = plan.shortfall;

      if (plan.movement) {
        movements.push(plan.movement);
      }

      if (plan.average) {
        averages.push(plan.average);
      }
    }

    this.transferStatus = planned.some((plan) => plan.shortfall !== 0)
      ? TRANSFER_STATUS.RECEIVED_WITH_DIFFERENCES
      : TRANSFER_STATUS.RECEIVED;
    this.stampedReceivedAt = input.occurredAt;
    this.stampedReceivedBy = input.actorId;

    return { movements, averages };
  }

  private planReceipt(
    line: StoredLine,
    lines: readonly ReceiveTransferLine[],
  ): PlannedReceipt {
    const received = lines.find(
      (item) => item.ingredientId === line.ingredientId,
    );

    if (!received || line.unitCost === undefined) {
      throw new InvalidTransfer();
    }

    if (
      !Number.isInteger(received.receivedQuantity) ||
      received.receivedQuantity < 0 ||
      received.receivedQuantity > line.quantity
    ) {
      throw new InvalidTransfer();
    }

    const shortfall = line.quantity - received.receivedQuantity;

    if (received.receivedQuantity === 0) {
      return {
        ingredientId: line.ingredientId,
        receivedQuantity: 0,
        shortfall,
      };
    }

    const movement = {
      ingredientId: line.ingredientId,
      type: MOVEMENT_TYPE.TRANSFER_IN,
      quantity: received.receivedQuantity,
      unitCost: line.unitCost,
    };

    return {
      ingredientId: line.ingredientId,
      receivedQuantity: received.receivedQuantity,
      shortfall,
      movement,
      average: {
        ingredientId: line.ingredientId,
        averageCost: nextAverageCost({
          onHand: received.onHand,
          averageCost: received.averageCost,
          receivedQuantity: received.receivedQuantity,
          receiptCost: line.unitCost,
        }),
      },
    };
  }
}
