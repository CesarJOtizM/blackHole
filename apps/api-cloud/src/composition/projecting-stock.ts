import {
  type EvaluateStockLevels,
  type ExplodeRecipe,
  type ProjectProducibleQuantity,
  RecordWaste,
  RegisterSaleConsumption,
  ReturnStock,
} from "@blackhole/inventory/application/entry-port";
import type { OperationGeneration } from "@blackhole/inventory/application/ports/operation-generation";
import type { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import type { RecipeVersionReader } from "@blackhole/inventory/application/ports/recipe-version";
import type { ReferenceCostList } from "@blackhole/inventory/application/ports/reference-cost";
import type { StockAlertPublisher } from "@blackhole/inventory/application/ports/stock-alert-publisher";
import {
  CONSUMPTION_ROLE,
  type StockLedgerRepository,
} from "@blackhole/inventory/application/ports/stock-ledger-repository";
import type { StockMovementQueue } from "@blackhole/inventory/application/ports/stock-movement-queue";
import type { VenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

type StockProjector = (tenantId: string) => {
  execute(
    input: Parameters<ProjectProducibleQuantity["execute"]>[0],
  ): Promise<void>;
};

export class ProjectingSaleConsumption extends RegisterSaleConsumption {
  constructor(
    recipes: ExplodeRecipe,
    versions: RecipeVersionReader,
    costs: ReferenceCostList,
    venues: VenueDirectory,
    pointsOfSale: PointOfSaleDirectory,
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    alerts: StockAlertPublisher,
    queue: StockMovementQueue,
    private readonly project: StockProjector,
    levels: EvaluateStockLevels | null = null,
  ) {
    super(
      recipes,
      versions,
      costs,
      venues,
      pointsOfSale,
      generations,
      ledger,
      alerts,
      queue,
      levels,
    );
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(
    input: Parameters<RegisterSaleConsumption["execute"]>[0],
  ) {
    const result = await super.execute(input);

    if (!result.missingRecipe) {
      await projectMovedStock(
        this.movedLedger,
        this.project,
        input.tenantId,
        input.venueId,
        input.orderLineId,
        CONSUMPTION_ROLE.CONSUMPTION,
      );
    }

    return result;
  }
}

export class ProjectingReturnStock extends ReturnStock {
  constructor(
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    queue: StockMovementQueue,
    private readonly project: StockProjector,
    levels: EvaluateStockLevels | null = null,
    venues: VenueDirectory | null = null,
  ) {
    super(generations, ledger, queue, levels, venues);
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(input: Parameters<ReturnStock["execute"]>[0]) {
    const result = await super.execute(input);
    await projectMovedStock(
      this.movedLedger,
      this.project,
      input.tenantId,
      input.venueId,
      input.orderLineId,
      CONSUMPTION_ROLE.REVERSAL,
    );

    return result;
  }
}

export class ProjectingRecordWaste extends RecordWaste {
  constructor(
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    queue: StockMovementQueue,
    audits: RecordAuditEvent,
    private readonly project: StockProjector,
    levels: EvaluateStockLevels | null = null,
    venues: VenueDirectory | null = null,
  ) {
    super(generations, ledger, queue, audits, levels, venues);
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(input: Parameters<RecordWaste["execute"]>[0]) {
    const result = await super.execute(input);
    await projectMovedStock(
      this.movedLedger,
      this.project,
      input.tenantId,
      input.venueId,
      input.orderLineId,
      CONSUMPTION_ROLE.REVERSAL,
    );

    return result;
  }
}

const projectMovedStock = async (
  ledger: StockLedgerRepository,
  project: StockProjector,
  tenantId: string,
  venueId: string,
  orderLineId: string,
  role: (typeof CONSUMPTION_ROLE)[keyof typeof CONSUMPTION_ROLE],
): Promise<void> => {
  const lines = await ledger.findLine(tenantId, orderLineId, role);

  for (const line of lines) {
    await project(tenantId).execute({
      kind: "stock",
      tenantId,
      siteId: venueId,
      locationId: line.locationId,
      ingredientId: line.ingredientId,
    });
  }
};
