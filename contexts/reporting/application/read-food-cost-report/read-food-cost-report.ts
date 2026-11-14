import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import type {
  InventoryFacts,
  InventoryMovementLine,
} from "#application/ports/inventory-facts.js";
import type {
  OperationFacts,
  ServiceLineFact,
} from "#application/ports/operation-facts.js";
import type { ReportAccess } from "#application/ports/report-access.js";
import { REPORT_PERMISSION } from "#application/ports/report-access.js";
import type {
  FoodCostConsumption,
  FoodCostSale,
  RecipeVersionLine,
} from "#domain/metrics.js";
import { foodCostRatio, netSalesCop } from "#domain/metrics.js";

export interface FoodCostProductRow {
  productId: string;
  recipeVersions: readonly RecipeVersionLine[];
}

export interface FoodCostReport {
  ratio: number | null;
  theoreticalCop: number;
  netSalesCop: number;
  uncostedProductIds: readonly string[];
  products: readonly FoodCostProductRow[];
}

export type FoodCostReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: FoodCostReport };

const distinctMovements = (
  lines: readonly InventoryMovementLine[],
): InventoryMovementLine[] => {
  const seen = new Set<string>();
  const unique: InventoryMovementLine[] = [];

  for (const line of lines) {
    if (seen.has(line.id)) {
      continue;
    }

    seen.add(line.id);
    unique.push(line);
  }

  return unique;
};

const productsOf = (
  versions: readonly RecipeVersionLine[],
): FoodCostProductRow[] => {
  const grouped = new Map<string, RecipeVersionLine[]>();

  for (const version of versions) {
    const current = grouped.get(version.productId);

    if (current === undefined) {
      grouped.set(version.productId, [version]);
      continue;
    }

    current.push(version);
  }

  return [...grouped.entries()].map(([productId, recipeVersions]) => ({
    productId,
    recipeVersions,
  }));
};

const listedOnce = (current: readonly string[], productId: string): string[] =>
  current.includes(productId) ? [...current] : [...current, productId];

const inWindow = (instant: string, from: string, to: string): boolean =>
  instant >= from && instant < to;

const isCostLine = (
  movement: InventoryMovementLine,
): movement is InventoryMovementLine & {
  kind: FoodCostConsumption["kind"];
} => movement.kind === "sale_consumption" || movement.kind === "sale_return";

const authorize = async (
  access: ReportAccess,
  command: ReportCommand,
): Promise<
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "allowed"; venueId: string; from: string; to: string }
> => {
  if (command.venueId !== command.homeVenueId) {
    return { outcome: "denied", reason: "other_venue" };
  }

  if (command.role === "waiter") {
    return { outcome: "denied", reason: "missing_permission" };
  }

  const permitted = await access.allows({
    tenantId: command.tenantId,
    actorId: command.actorId,
    venueId: command.venueId,
    permission: REPORT_PERMISSION.VIEW_COST,
  });

  if (!permitted) {
    return { outcome: "denied", reason: "missing_permission" };
  }

  return {
    outcome: "allowed",
    venueId: command.venueId,
    from: command.from,
    to: command.to,
  };
};

export class ReadFoodCostReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly sales: OperationFacts,
    private readonly inventory: InventoryFacts,
  ) {}

  async execute(command: ReportCommand): Promise<FoodCostReportResult> {
    const decision = await authorize(this.access, command);

    if (decision.outcome === "denied") {
      return decision;
    }

    const [operations, stock] = await Promise.all([
      this.sales.read({
        tenantId: command.tenantId,
        venueId: decision.venueId,
        from: decision.from,
        to: decision.to,
      }),
      this.inventory.read({
        tenantId: command.tenantId,
        venueId: decision.venueId,
        from: decision.from,
        to: decision.to,
      }),
    ]);

    return {
      outcome: "ready",
      report: this.report(
        operations.lines,
        distinctMovements(stock.movements),
        decision.from,
        decision.to,
      ),
    };
  }

  private report(
    lines: readonly ServiceLineFact[],
    movements: readonly InventoryMovementLine[],
    from: string,
    to: string,
  ): FoodCostReport {
    const sales: FoodCostSale[] = [];
    const consumptions: FoodCostConsumption[] = [];
    let uncostedProductIds: string[] = [];

    for (const line of lines) {
      const chargedAt = line.chargedAt;

      if (line.voided || chargedAt === null || !inWindow(chargedAt, from, to)) {
        continue;
      }

      const linked = movements.filter(
        (movement) =>
          movement.orderLineId === line.lineId && isCostLine(movement),
      );
      const costed = linked.some(
        (movement) => movement.kind === "sale_consumption",
      );

      if (!costed) {
        uncostedProductIds = listedOnce(uncostedProductIds, line.productId);
        continue;
      }

      sales.push({
        productId: line.productId,
        occurredAt: chargedAt,
        netSalesCop: netSalesCop({
          grossCop: line.grossCop,
          discountCop: line.discountCop,
          includedTaxCop: line.includedTaxCop,
          tipCop: line.tipCop,
        }),
      });

      for (const movement of linked) {
        if (!isCostLine(movement)) {
          continue;
        }

        consumptions.push({
          productId: line.productId,
          occurredAt: movement.occurredAt,
          quantity: movement.quantity,
          unitCostCop: movement.unitCost,
          recipeVersion: movement.recipeVersion,
          kind: movement.kind,
        });
      }
    }

    const ratio = foodCostRatio({ from, to, sales, consumptions });

    for (const productId of ratio.uncostedProductIds) {
      uncostedProductIds = listedOnce(uncostedProductIds, productId);
    }

    return {
      ratio: ratio.ratio,
      theoreticalCop: ratio.theoreticalCop,
      netSalesCop: ratio.netSalesCop,
      uncostedProductIds,
      products: productsOf(ratio.recipeVersions),
    };
  }
}
