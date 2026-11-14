import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import type {
  InventoryFacts,
  InventoryMovementLine,
} from "#application/ports/inventory-facts.js";
import type { ReportAccess } from "#application/ports/report-access.js";
import { REPORT_PERMISSION } from "#application/ports/report-access.js";
import type { StockGapResult } from "#domain/metrics.js";
import { stockGap } from "#domain/metrics.js";

export type StockGapReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: StockGapResult };

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

export class ReadStockGapReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly inventory: InventoryFacts,
  ) {}

  async execute(command: ReportCommand): Promise<StockGapReportResult> {
    const decision = await authorize(this.access, command);

    if (decision.outcome === "denied") {
      return decision;
    }

    const snapshot = await this.inventory.read({
      tenantId: command.tenantId,
      venueId: decision.venueId,
      from: decision.from,
      to: decision.to,
    });
    const movements = distinctMovements(snapshot.movements);

    return {
      outcome: "ready",
      report: stockGap({
        counts: snapshot.counts.map((count) => ({
          locationId: count.locationId,
          ingredientId: count.ingredientId,
          quantity: count.quantity,
          approvedAt: count.approvedAt,
          averageCostCop: count.averageCostCop,
        })),
        movements: movements.map((movement) => ({
          locationId: movement.locationId,
          ingredientId: movement.ingredientId,
          kind: movement.kind,
          quantity: movement.quantity,
          occurredAt: movement.occurredAt,
        })),
      }),
    };
  }
}
