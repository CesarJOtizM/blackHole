import {
  type EvaluatePermission,
  LimitRaised,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";

import type { IngredientClassification } from "#application/ports/ingredient-classification.js";
import type { PublishedPurchaseFactor } from "#application/ports/published-purchase-factor.js";
import {
  COUNT_LINE_ROLE,
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountSession,
  type CountSessionLine,
  type StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  COUNT_SCOPE,
  type CountScope,
  InvalidCount,
  submitStockCount,
} from "#domain/stock-count.js";
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

export interface RecordStockCountLine {
  ingredientId: string;
  purchaseQuantity: number;
}

export interface RecordStockCountInput {
  tenantId: string;
  venueId: string;
  locationId: string;
  documentId: string;
  cutOff: string;
  occurredAt: string;
  scope: CountScope;
  category?: string;
  lines: readonly RecordStockCountLine[];
  actorId: string;
  sessionId: string;
  deviceId: string;
  siteCap?: number;
}

export interface PostedCountLine {
  movementId: string;
  ingredientId: string;
  quantity: number;
  valueCop: number;
  averageCost: number;
}

export interface PostedStockCount {
  posted: true;
  valueCop: number;
  lines: readonly PostedCountLine[];
}

export interface StockCountNeedsAuthorizer {
  posted: false;
  outcome: "requires_authorization";
  exceededLimit: { code: string; cap: number; unit: string } | null;
}

export interface StockCountDenied {
  posted: false;
  outcome: "denied";
}

export interface StockCountSheetInput {
  tenantId: string;
  venueId: string;
  locationId: string;
  cutOff: string;
  scope: CountScope;
  category?: string;
  sessionId: string;
}

export interface ReadyStockCountSheet {
  outcome: "ready";
  ingredientIds: readonly string[];
}

export type StockCountSheet = ReadyStockCountSheet | { outcome: "denied" };

export type RecordStockCountResult =
  | PostedStockCount
  | StockCountNeedsAuthorizer
  | StockCountDenied;

const COMPANY_COUNT_CAP = 1000;
const COUNT_LIMIT = "countAdjustmentCop";

const lineId = (documentId: string, ingredientId: string): string =>
  `movement_${documentId}_${ingredientId}`;

export class RecordStockCount {
  constructor(
    private readonly permissions: EvaluatePermission,
    private readonly counts: StockCountRepository,
    private readonly classifications: IngredientClassification,
    private readonly factors: PublishedPurchaseFactor,
    private readonly audits: RecordAuditEvent,
  ) {}

  async sheet(input: StockCountSheetInput): Promise<StockCountSheet> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_COUNT,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      return { outcome: "denied" };
    }

    return {
      outcome: "ready",
      ingredientIds: await this.ingredientIds(input),
    };
  }

  async execute(input: RecordStockCountInput): Promise<RecordStockCountResult> {
    const cap = siteCap(input.siteCap);
    const frozen = await this.freeze(input);
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_COUNT,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: frozen.valueCop,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome === "requires_authorization") {
      return {
        posted: false,
        outcome: "requires_authorization",
        exceededLimit: decision.exceededLimit,
      };
    }

    if (decision.outcome !== "allowed") {
      return { posted: false, outcome: "denied" };
    }

    if (frozen.valueCop > cap) {
      await this.counts.saveSession(
        session(input, frozen, COUNT_SESSION_STATUS.PENDING),
      );
      return {
        posted: false,
        outcome: "requires_authorization",
        exceededLimit: { code: COUNT_LIMIT, cap, unit: "cop" },
      };
    }

    const movements = frozen.lines.map((line) => postedLine(input, line));

    for (const movement of movements) {
      StockLedger.open({
        tenantId: input.tenantId,
        locationId: input.locationId,
      }).append({
        id: movement.id,
        ingredientId: movement.ingredientId,
        quantity: movement.quantity,
        unitCost: movement.unitCost,
        type: movement.type,
        reference: movement.reference,
        occurredAt: movement.occurredAt,
      });
    }

    if (movements.length > 0) {
      await this.counts.appendAdjustments(movements);
    }

    await this.counts.saveSession(
      session(input, frozen, COUNT_SESSION_STATUS.POSTED),
    );

    if (frozen.lines.length === 1) {
      const line = frozen.lines[0];

      if (line) {
        await this.audits.execute({
          tenantId: input.tenantId,
          actorId: input.actorId,
          authorizerId: null,
          deviceId: input.deviceId,
          siteId: input.venueId,
          action: PERMISSION.INVENTORY_COUNT,
          entity: input.documentId,
          before: { averageCost: line.averageCost },
          after: {
            movementId: lineId(input.documentId, line.ingredientId),
            quantity: line.quantity,
            valueCop: line.valueCop,
          },
          reason: input.category ?? input.scope,
        });
      }
    }

    return {
      posted: true,
      valueCop: frozen.valueCop,
      lines: frozen.lines.map((line) => ({
        movementId: lineId(input.documentId, line.ingredientId),
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        valueCop: line.valueCop,
        averageCost: line.averageCost,
      })),
    };
  }

  private async ingredientIds(
    input: StockCountSheetInput,
    chronological?: readonly CountLedgerLine[],
  ): Promise<string[]> {
    if (
      input.scope === COUNT_SCOPE.CATEGORY &&
      (input.category === undefined || input.category.length === 0)
    ) {
      throw new InvalidCount();
    }

    const lines =
      chronological ??
      (await this.counts.movementsAt(
        input.tenantId,
        input.venueId,
        input.locationId,
      ));
    const ordered = chronological
      ? lines
      : lines.toSorted((left, right) => {
          const byTime = left.occurredAt.localeCompare(right.occurredAt);

          if (byTime !== 0) {
            return byTime;
          }

          return left.id.localeCompare(right.id);
        });
    const cutOff = instant(input.cutOff);
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const line of ordered) {
      if (instant(line.occurredAt) > cutOff || seen.has(line.ingredientId)) {
        continue;
      }

      seen.add(line.ingredientId);
      candidates.push(line.ingredientId);
    }

    const categories = await Promise.all(
      candidates.map((ingredientId) =>
        this.classifications.find(input.tenantId, ingredientId),
      ),
    );

    return candidates.filter((_ingredientId, index) => {
      if (input.scope !== COUNT_SCOPE.CATEGORY) {
        return true;
      }

      return categories[index]?.category === input.category;
    });
  }

  private async freeze(input: RecordStockCountInput): Promise<FrozenCount> {
    if (
      input.scope === COUNT_SCOPE.CATEGORY &&
      (input.category === undefined || input.category.length === 0)
    ) {
      throw new InvalidCount();
    }

    const stored = await this.counts.movementsAt(
      input.tenantId,
      input.venueId,
      input.locationId,
    );
    const ledger = StockLedger.open({
      tenantId: input.tenantId,
      locationId: input.locationId,
    });
    const chronological = stored.toSorted((left, right) => {
      const byTime = left.occurredAt.localeCompare(right.occurredAt);

      if (byTime !== 0) {
        return byTime;
      }

      return left.id.localeCompare(right.id);
    });

    for (const line of chronological) {
      ledger.append({
        id: line.id,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        type: line.type,
        reference: line.reference,
        occurredAt: line.occurredAt,
        ...(line.reversesMovementId === undefined
          ? {}
          : { reversesMovementId: line.reversesMovementId }),
      });
    }

    const expected = await this.ingredientIds(input, chronological);
    const counted = await Promise.all(
      input.lines.map(async (line) => ({
        ingredientId: line.ingredientId,
        quantity: baseUnits(
          line.purchaseQuantity,
          await this.factors.factorOf(input.tenantId, line.ingredientId),
        ),
      })),
    );
    // balanceUntil and averageCostUntil stop at the cut-off. The average is copied.
    const result = submitStockCount({
      locationId: input.locationId,
      cutOff: input.cutOff,
      scope: input.scope,
      ...(input.scope === COUNT_SCOPE.CATEGORY
        ? { classification: expected }
        : {}),
      movements: expected.map((ingredientId) => ({
        id: `cutoff_${ingredientId}`,
        locationId: input.locationId,
        ingredientId,
        quantity: baseQuantity(ledger.balanceUntil(ingredientId, input.cutOff)),
        occurredAt: input.cutOff,
        type: MOVEMENT_TYPE.PURCHASE,
      })),
      averageCosts: expected.map((ingredientId) => ({
        ingredientId,
        averageCost: ledger.averageCostUntil(ingredientId, input.cutOff),
      })),
      lines: counted,
    });

    return {
      valueCop: result.valueCop,
      lines: result.lines.map((line) => ({
        ingredientId: line.ingredientId,
        // The domain compared base units. The ledger stores them times QUANTITY_SCALE.
        quantity: line.quantity * QUANTITY_SCALE,
        averageCost: line.averageCost,
        valueCop: line.valueCop,
      })),
    };
  }
}

interface FrozenCount {
  valueCop: number;
  lines: readonly CountSessionLine[];
}

function siteCap(requested: number | undefined): number {
  if (requested === undefined) {
    return COMPANY_COUNT_CAP;
  }

  if (!Number.isInteger(requested) || requested < 0) {
    throw new InvalidCount();
  }

  if (requested > COMPANY_COUNT_CAP) {
    throw new LimitRaised();
  }

  return requested;
}

function session(
  input: RecordStockCountInput,
  frozen: FrozenCount,
  status: CountSession["status"],
): CountSession {
  return {
    tenantId: input.tenantId,
    venueId: input.venueId,
    locationId: input.locationId,
    documentId: input.documentId,
    cutOff: input.cutOff,
    status,
    lines: frozen.lines,
    valueCop: frozen.valueCop,
  };
}

function postedLine(
  input: RecordStockCountInput,
  line: CountSessionLine,
): CountLedgerLine {
  return {
    id: lineId(input.documentId, line.ingredientId),
    tenantId: input.tenantId,
    venueId: input.venueId,
    locationId: input.locationId,
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.averageCost,
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    reference: input.documentId,
    occurredAt: input.occurredAt,
    orderLineId: input.documentId,
    role: COUNT_LINE_ROLE.COUNT_ADJUSTMENT,
    recipeVersion: 0,
    reason: null,
    actorId: input.actorId,
  };
}

function baseUnits(purchaseQuantity: number, factor: number): number {
  if (
    !Number.isInteger(purchaseQuantity) ||
    purchaseQuantity < 0 ||
    !Number.isInteger(factor) ||
    factor <= 0
  ) {
    throw new InvalidCount();
  }

  return purchaseQuantity * factor;
}

function baseQuantity(scaled: number): number {
  if (!Number.isInteger(scaled) || scaled % QUANTITY_SCALE !== 0) {
    throw new InvalidCount();
  }

  return scaled / QUANTITY_SCALE;
}

function instant(value: string): number {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new InvalidCount();
  }

  return parsed;
}
