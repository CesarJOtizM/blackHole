const SHIFT_ID_PREFIX = "shift_";
const MOVEMENT_ID_PREFIX = "movement_";
const REVERSAL_ID_PREFIX = "reversal_";
const ORIGINAL_PAYMENT_PREFIX = "payment_";

const SHIFT_STATE = {
  OPEN: "open",
} as const;

const MOVEMENT_KIND = {
  CASH_IN: "cash_in",
  CASH_OUT: "cash_out",
  WITHDRAWAL: "withdrawal",
} as const;

export type ShiftState = (typeof SHIFT_STATE)[keyof typeof SHIFT_STATE];

export type CashMovementKind =
  (typeof MOVEMENT_KIND)[keyof typeof MOVEMENT_KIND];

export interface CashMovement {
  id: string;
  kind: CashMovementKind;
  amountCop: number;
  reason: string;
}

const TENDER_METHOD = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
  WALLET: "wallet",
  VOUCHER: "voucher",
  CUSTOMER_CREDIT: "customer_credit",
  CORPORATE_CREDIT: "corporate_credit",
  QR: "qr",
} as const;

export type TenderMethod = (typeof TENDER_METHOD)[keyof typeof TENDER_METHOD];

export interface PaymentReversal {
  id: string;
  originalPaymentId: string;
  amountCop: number;
}

export interface ShiftPayment {
  id: string;
  originalPaymentId: string;
  method: TenderMethod;
  amountCop: number;
}

interface OpenShift {
  id: string;
  cashierId: string;
  openingFloatCop: number;
  openedAt?: string;
}

interface OpenedShift {
  id: string;
  cashierId: string;
  openingFloatCop: number;
  openedAt: string | null;
  state: ShiftState;
}

interface RecordMovement {
  id: string;
  kind: CashMovementKind;
  amountCop: number;
  reason: string;
}

export class ShiftAlreadyOpen extends Error {
  constructor() {
    super("The cash register already has an open shift.");
    this.name = "ShiftAlreadyOpen";
  }
}

export class InvalidShiftId extends Error {
  constructor() {
    super("A shift identifier must use the shift_ prefix.");
    this.name = "InvalidShiftId";
  }
}

export class InvalidCashAmount extends Error {
  constructor() {
    super("A cash amount must be an integer number of COP.");
    this.name = "InvalidCashAmount";
  }
}

export class InvalidMovementId extends Error {
  constructor() {
    super("A movement identifier must use the movement_ prefix.");
    this.name = "InvalidMovementId";
  }
}

export class MissingReason extends Error {
  constructor() {
    super("A cash movement requires a reason.");
    this.name = "MissingReason";
  }
}

export class InvalidReversalId extends Error {
  constructor() {
    super("A reversal identifier must use the reversal_ prefix.");
    this.name = "InvalidReversalId";
  }
}

export class InvalidOriginalPayment extends Error {
  constructor() {
    super("A reversal must point at a payment_ identifier.");
    this.name = "InvalidOriginalPayment";
  }
}

export class InvalidReplacementId extends Error {
  constructor() {
    super("A replacement payment identifier must use the payment_ prefix.");
    this.name = "InvalidReplacementId";
  }
}

export class InvalidTenderMethod extends Error {
  constructor() {
    super("A replacement payment must use a known tender method.");
    this.name = "InvalidTenderMethod";
  }
}

class OpenShiftRequired extends Error {
  constructor() {
    super("A cash movement requires an open shift.");
    this.name = "OpenShiftRequired";
  }
}

function assertShiftId(id: string): void {
  if (!id.startsWith(SHIFT_ID_PREFIX) || id.length === SHIFT_ID_PREFIX.length) {
    throw new InvalidShiftId();
  }
}

function assertMovementId(id: string): void {
  if (
    !id.startsWith(MOVEMENT_ID_PREFIX) ||
    id.length === MOVEMENT_ID_PREFIX.length
  ) {
    throw new InvalidMovementId();
  }
}

function assertCop(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidCashAmount();
  }
}

function assertReason(reason: string): void {
  if (reason.trim().length === 0) {
    throw new MissingReason();
  }
}

function assertReversalId(id: string): void {
  if (
    !id.startsWith(REVERSAL_ID_PREFIX) ||
    id.length === REVERSAL_ID_PREFIX.length
  ) {
    throw new InvalidReversalId();
  }
}

function assertOriginalPaymentId(id: string): void {
  if (
    !id.startsWith(ORIGINAL_PAYMENT_PREFIX) ||
    id.length === ORIGINAL_PAYMENT_PREFIX.length
  ) {
    throw new InvalidOriginalPayment();
  }
}

function assertReplacementId(id: string): void {
  if (
    !id.startsWith(ORIGINAL_PAYMENT_PREFIX) ||
    id.length === ORIGINAL_PAYMENT_PREFIX.length
  ) {
    throw new InvalidReplacementId();
  }
}

function assertTenderMethod(method: string): asserts method is TenderMethod {
  switch (method) {
    case TENDER_METHOD.CASH:
    case TENDER_METHOD.CARD:
    case TENDER_METHOD.TRANSFER:
    case TENDER_METHOD.WALLET:
    case TENDER_METHOD.VOUCHER:
    case TENDER_METHOD.CUSTOMER_CREDIT:
    case TENDER_METHOD.CORPORATE_CREDIT:
    case TENDER_METHOD.QR:
      return;
    default:
      throw new InvalidTenderMethod();
  }
}

function movementEffectCop(movement: CashMovement): number {
  switch (movement.kind) {
    case MOVEMENT_KIND.CASH_IN:
      return movement.amountCop;
    case MOVEMENT_KIND.CASH_OUT:
    case MOVEMENT_KIND.WITHDRAWAL:
      return -movement.amountCop;
    default: {
      const unexpected: never = movement.kind;
      throw new Error(`Unexpected cash movement kind: ${String(unexpected)}`);
    }
  }
}

export class CashShift {
  readonly registerId: string;

  private openedShift: OpenedShift | undefined;

  private readonly recordedMovements: CashMovement[] = [];

  private readonly recordedReversals: PaymentReversal[] = [];

  private readonly recordedPayments: ShiftPayment[] = [];

  private constructor(registerId: string) {
    this.registerId = registerId;
  }

  static forRegister(registerId: string): CashShift {
    return new CashShift(registerId);
  }

  get id(): string | undefined {
    return this.openedShift?.id;
  }

  get cashierId(): string | undefined {
    return this.openedShift?.cashierId;
  }

  get openingFloatCop(): number | undefined {
    return this.openedShift?.openingFloatCop;
  }

  get openedAt(): string | null {
    return this.openedShift?.openedAt ?? null;
  }

  get state(): ShiftState | undefined {
    return this.openedShift?.state;
  }

  get movements(): readonly CashMovement[] {
    return this.recordedMovements.map((movement) => ({ ...movement }));
  }

  get reversals(): readonly PaymentReversal[] {
    return this.recordedReversals.map((reversal) => ({ ...reversal }));
  }

  get payments(): readonly ShiftPayment[] {
    return this.recordedPayments.map((payment) => ({ ...payment }));
  }

  get expectedCashCop(): number | undefined {
    if (!this.openedShift) {
      return undefined;
    }

    return this.recordedMovements.reduce(
      (expected, movement) => expected + movementEffectCop(movement),
      this.openedShift.openingFloatCop,
    );
  }

  open(input: OpenShift): void {
    if (this.openedShift) {
      throw new ShiftAlreadyOpen();
    }

    assertShiftId(input.id);
    assertCop(input.openingFloatCop);

    this.openedShift = {
      id: input.id,
      cashierId: input.cashierId,
      openingFloatCop: input.openingFloatCop,
      openedAt: input.openedAt ?? null,
      state: SHIFT_STATE.OPEN,
    };
  }

  recordMovement(input: RecordMovement): void {
    if (!this.openedShift) {
      throw new OpenShiftRequired();
    }

    assertMovementId(input.id);
    assertCop(input.amountCop);
    assertReason(input.reason);

    this.recordedMovements.push({
      id: input.id,
      kind: input.kind,
      amountCop: input.amountCop,
      reason: input.reason,
    });
  }

  recordReversal(input: PaymentReversal): void {
    if (!this.openedShift || this.openedShift.state !== SHIFT_STATE.OPEN) {
      throw new OpenShiftRequired();
    }

    assertReversalId(input.id);
    assertOriginalPaymentId(input.originalPaymentId);
    assertCop(input.amountCop);

    this.recordedReversals.push({
      id: input.id,
      originalPaymentId: input.originalPaymentId,
      amountCop: input.amountCop,
    });
  }

  recordPayment(input: ShiftPayment): void {
    if (!this.openedShift || this.openedShift.state !== SHIFT_STATE.OPEN) {
      throw new OpenShiftRequired();
    }

    assertReplacementId(input.id);
    assertOriginalPaymentId(input.originalPaymentId);
    assertTenderMethod(input.method);
    assertCop(input.amountCop);

    this.recordedPayments.push({
      id: input.id,
      originalPaymentId: input.originalPaymentId,
      method: input.method,
      amountCop: input.amountCop,
    });
  }
}
