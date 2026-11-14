import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

export const WASTE_REASON = {
  EXPIRED: "expired",
  DAMAGED: "damaged",
  PREPARATION_ERROR: "preparation_error",
  OTHER: "other",
} as const;

export type WasteReason = (typeof WASTE_REASON)[keyof typeof WASTE_REASON];

const WASTE_REASONS: ReadonlySet<string> = new Set(Object.values(WASTE_REASON));

export class MissingWasteReason extends Error {
  constructor() {
    super("A waste record must state a reason.");
    this.name = "MissingWasteReason";
  }
}

export class WasteNoteRequired extends Error {
  constructor() {
    super("Waste reason other requires a note.");
    this.name = "WasteNoteRequired";
  }
}

export class InvalidWaste extends Error {
  constructor() {
    super(
      "Waste quantity must be a negative whole number of base units, and its value must be whole COP.",
    );
    this.name = "InvalidWaste";
  }
}

export interface OperationalWaste {
  locationId: string;
  ingredientId: string;
  quantity: number;
  averageCost: number;
  valueCop: number;
  reason: WasteReason;
  type: typeof MOVEMENT_TYPE.WASTE;
  note?: string;
}

interface RecordOperationalWaste {
  locationId: string;
  ingredientId: string;
  quantity: number;
  averageCost: number;
  reason?: string;
  note?: string;
}

// Quantity stays negative. Average cost is the snapshot passed in.
// This record does not recompute it and does not point at a reversal.
export function recordOperationalWaste(
  input: RecordOperationalWaste,
): OperationalWaste {
  const reason = wasteReason(input.reason);
  const note = trimmedNote(input.note);

  if (reason === WASTE_REASON.OTHER && note === undefined) {
    throw new WasteNoteRequired();
  }

  if (!Number.isInteger(input.quantity) || input.quantity >= 0) {
    throw new InvalidWaste();
  }

  if (!Number.isInteger(input.averageCost) || input.averageCost < 0) {
    throw new InvalidWaste();
  }

  const valueCop = wholeCop(input.quantity, input.averageCost);

  return {
    locationId: input.locationId,
    ingredientId: input.ingredientId,
    quantity: input.quantity,
    averageCost: input.averageCost,
    valueCop,
    reason,
    type: MOVEMENT_TYPE.WASTE,
    ...(note === undefined ? {} : { note }),
  };
}

function wasteReason(reason: string | undefined): WasteReason {
  if (reason === undefined || reason === "" || !WASTE_REASONS.has(reason)) {
    throw new MissingWasteReason();
  }

  return reason as WasteReason;
}

function trimmedNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim();

  if (trimmed === undefined || trimmed === "") {
    return undefined;
  }

  return trimmed;
}

function wholeCop(quantity: number, averageCost: number): number {
  const value = (Math.abs(quantity) * averageCost) / QUANTITY_SCALE;

  if (!Number.isInteger(value)) {
    throw new InvalidWaste();
  }

  return value;
}
