import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";

export const PURCHASE_ORDER_STATUS = {
  OPEN: "open",
  PARTIALLY_RECEIVED: "partially_received",
  RECEIVED: "received",
  CANCELLED: "cancelled",
} as const;

export type PurchaseOrderStatus =
  (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  PURCHASE_ORDER_STATUS.RECEIVED,
  PURCHASE_ORDER_STATUS.CANCELLED,
]);

export class DuplicateId extends Error {
  constructor() {
    super("A purchasing identifier is already in use.");
    this.name = "DuplicateId";
  }
}

export class PurchaseOrderClosed extends Error {
  constructor() {
    super("A closed purchase order cannot accept a receipt.");
    this.name = "PurchaseOrderClosed";
  }
}

export class OverReceipt extends Error {
  constructor() {
    super("A receipt cannot exceed the remaining purchase quantity.");
    this.name = "OverReceipt";
  }
}

export class InvalidPurchase extends Error {
  constructor() {
    super("A purchase quantity, factor, and cost must be whole numbers.");
    this.name = "InvalidPurchase";
  }
}

export interface Supplier {
  id: string;
  identification: string;
  name: string;
  issuesEInvoices: boolean;
  leadTimeDays: number;
}

export interface BaseReceipt {
  purchaseQuantity: number;
  purchaseUnitCost: number;
  factor: number;
  quantity: number;
  unitCost: number;
}

interface BaseReceiptInput {
  purchaseQuantity: number;
  purchaseUnitCost: number;
  factor: number;
}

interface OrderLineInput {
  id: string;
  ingredientId: string;
  purchaseQuantity: number;
  factor: number;
}

interface OpenPurchaseOrder {
  id: string;
  supplierId: string;
  locationId: string;
  lines: readonly OrderLineInput[];
}

interface ReceiveLineInput {
  lineId: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
}

interface ReceivePurchase {
  receiptId: string;
  lines: readonly ReceiveLineInput[];
}

export interface ReceivedLine {
  lineId: string;
  ingredientId: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
  factor: number;
  quantity: number;
  unitCost: number;
}

interface StoredLine {
  id: string;
  ingredientId: string;
  purchaseQuantity: number;
  receivedQuantity: number;
  factor: number;
}

export interface PurchaseOrderLineView {
  id: string;
  ingredientId: string;
  purchaseQuantity: number;
  receivedQuantity: number;
  factor: number;
}

export function toBaseReceipt(input: BaseReceiptInput): BaseReceipt {
  assertPurchaseQuantity(input.purchaseQuantity);
  assertFactor(input.factor);
  assertPurchaseUnitCost(input.purchaseUnitCost);

  return {
    purchaseQuantity: input.purchaseQuantity,
    purchaseUnitCost: input.purchaseUnitCost,
    factor: input.factor,
    quantity: input.purchaseQuantity * input.factor,
    unitCost: roundHalfUp(
      input.purchaseUnitCost * QUANTITY_SCALE,
      input.factor,
    ),
  };
}

export class PurchaseOrder {
  readonly id: string;
  readonly supplierId: string;
  readonly locationId: string;

  private orderStatus: PurchaseOrderStatus = PURCHASE_ORDER_STATUS.OPEN;
  private readonly storedLines: StoredLine[];

  private constructor(
    id: string,
    supplierId: string,
    locationId: string,
    lines: StoredLine[],
  ) {
    this.id = id;
    this.supplierId = supplierId;
    this.locationId = locationId;
    this.storedLines = lines;
  }

  static open(input: OpenPurchaseOrder): PurchaseOrder {
    if (input.id.length === 0 || input.lines.length === 0) {
      throw new InvalidPurchase();
    }

    const seen = new Set<string>();
    const lines = input.lines.map((line) => {
      if (line.id.length === 0 || seen.has(line.id)) {
        throw new DuplicateId();
      }

      seen.add(line.id);
      assertPurchaseQuantity(line.purchaseQuantity);
      assertFactor(line.factor);

      return {
        id: line.id,
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        receivedQuantity: 0,
        factor: line.factor,
      };
    });

    return new PurchaseOrder(
      input.id,
      input.supplierId,
      input.locationId,
      lines,
    );
  }

  get status(): PurchaseOrderStatus {
    return this.orderStatus;
  }

  get lines(): readonly PurchaseOrderLineView[] {
    return this.storedLines.map((line) => ({ ...line }));
  }

  receive(input: ReceivePurchase): readonly ReceivedLine[] {
    if (input.receiptId.length === 0 || input.lines.length === 0) {
      throw new InvalidPurchase();
    }

    if (CLOSED_STATUSES.has(this.orderStatus)) {
      throw new PurchaseOrderClosed();
    }

    const pending = new Map<string, number>();
    const received = input.lines.map((line) => {
      const preview = this.preview(line, pending);
      pending.set(
        line.lineId,
        (pending.get(line.lineId) ?? 0) + line.purchaseQuantity,
      );
      return preview;
    });

    for (const line of received) {
      const stored = this.storedLine(line.lineId);
      stored.receivedQuantity += line.purchaseQuantity;
    }

    const complete = this.storedLines.every(
      (line) => line.receivedQuantity === line.purchaseQuantity,
    );
    this.orderStatus = complete
      ? PURCHASE_ORDER_STATUS.RECEIVED
      : PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED;

    return received;
  }

  cancel(): void {
    if (CLOSED_STATUSES.has(this.orderStatus)) {
      throw new PurchaseOrderClosed();
    }

    this.orderStatus = PURCHASE_ORDER_STATUS.CANCELLED;
  }

  private preview(
    input: ReceiveLineInput,
    pending: ReadonlyMap<string, number>,
  ): ReceivedLine {
    const stored = this.storedLine(input.lineId);
    assertPurchaseQuantity(input.purchaseQuantity);

    const already = stored.receivedQuantity + (pending.get(input.lineId) ?? 0);

    if (already + input.purchaseQuantity > stored.purchaseQuantity) {
      throw new OverReceipt();
    }

    const converted = toBaseReceipt({
      purchaseQuantity: input.purchaseQuantity,
      purchaseUnitCost: input.purchaseUnitCost,
      factor: stored.factor,
    });

    return {
      lineId: stored.id,
      ingredientId: stored.ingredientId,
      purchaseQuantity: converted.purchaseQuantity,
      purchaseUnitCost: converted.purchaseUnitCost,
      factor: converted.factor,
      quantity: converted.quantity,
      unitCost: converted.unitCost,
    };
  }

  private storedLine(lineId: string): StoredLine {
    const found = this.storedLines.find((line) => line.id === lineId);

    if (!found) {
      throw new InvalidPurchase();
    }

    return found;
  }
}

export class Purchasing {
  readonly tenantId: string;

  private readonly supplierById = new Map<string, Supplier>();
  private readonly orderById = new Map<string, PurchaseOrder>();

  private constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static open(input: { tenantId: string }): Purchasing {
    return new Purchasing(input.tenantId);
  }

  registerSupplier(input: Supplier): void {
    assertSupplier(input);

    if (this.supplierById.has(input.id)) {
      throw new DuplicateId();
    }

    this.supplierById.set(input.id, { ...input });
  }

  openOrder(input: OpenPurchaseOrder): PurchaseOrder {
    if (this.orderById.has(input.id)) {
      throw new DuplicateId();
    }

    const order = PurchaseOrder.open(input);
    this.orderById.set(order.id, order);
    return order;
  }

  get suppliers(): readonly Supplier[] {
    return [...this.supplierById.values()].map((item) => ({ ...item }));
  }

  get orders(): readonly PurchaseOrder[] {
    return [...this.orderById.values()];
  }
}

function assertSupplier(input: Supplier): void {
  if (
    input.id.length === 0 ||
    input.identification.length === 0 ||
    input.name.length === 0 ||
    typeof input.issuesEInvoices !== "boolean" ||
    !Number.isInteger(input.leadTimeDays) ||
    input.leadTimeDays < 0
  ) {
    throw new InvalidPurchase();
  }
}

function assertPurchaseQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidPurchase();
  }
}

function assertFactor(factor: number): void {
  if (!Number.isInteger(factor) || factor <= 0) {
    throw new InvalidPurchase();
  }
}

function assertPurchaseUnitCost(cost: number): void {
  if (!Number.isInteger(cost) || cost < 0) {
    throw new InvalidPurchase();
  }
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
