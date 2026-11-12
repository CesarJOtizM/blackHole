const INTENT_ID_PREFIX = "intent_";

export const QR_INTENT_NONE = "none" as const;

export type QrIntentNone = typeof QR_INTENT_NONE;

export type QrIntentStatus = "pending_acceptance" | "applied" | "rejected";

export interface QrIntentLine {
  productId: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  note?: string;
}

export interface QrIntentCommand {
  id: string;
  lines: readonly QrIntentLine[];
  price?: unknown;
  void?: unknown;
  discount?: unknown;
  courtesy?: unknown;
}

export class InvalidQrIntentId extends Error {
  constructor() {
    super("A QR order intent identifier must use the intent_ prefix.");
    this.name = "InvalidQrIntentId";
  }
}

export class QrIntentForbidden extends Error {
  constructor() {
    super(
      "A QR order intent cannot carry a price, void, discount, or courtesy.",
    );
    this.name = "QrIntentForbidden";
  }
}

const forbidden = (command: QrIntentCommand): boolean =>
  command.price !== undefined ||
  command.void !== undefined ||
  command.discount !== undefined ||
  command.courtesy !== undefined;

const copyLine = (line: QrIntentLine): QrIntentLine => ({
  productId: line.productId,
  variantIds: [...line.variantIds],
  modifierIds: [...line.modifierIds],
  ...(line.note === undefined || line.note === "" ? {} : { note: line.note }),
});

export class QrOrderIntent {
  readonly id: string;
  readonly lines: readonly QrIntentLine[];

  private statusValue: QrIntentStatus = "pending_acceptance";

  private constructor(id: string, lines: readonly QrIntentLine[]) {
    this.id = id;
    this.lines = lines.map((line) => copyLine(line));
  }

  static receive(command: QrIntentCommand): QrOrderIntent | QrIntentNone {
    if (forbidden(command)) {
      throw new QrIntentForbidden();
    }

    if (
      !command.id.startsWith(INTENT_ID_PREFIX) ||
      command.id.length === INTENT_ID_PREFIX.length
    ) {
      throw new InvalidQrIntentId();
    }

    if (command.lines.length === 0) {
      return QR_INTENT_NONE;
    }

    return new QrOrderIntent(command.id, command.lines);
  }

  get status(): QrIntentStatus {
    return this.statusValue;
  }

  markApplied(): void {
    this.statusValue = "applied";
  }

  reject(): void {
    this.statusValue = "rejected";
  }
}
