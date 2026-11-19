import type { ProjectProducibleQuantityInput } from "@blackhole/inventory/application/entry-port";

export interface StockReceipt {
  tenantId: string;
  venueId: string | null;
  locationId: string;
  ingredientIds: readonly string[];
}

type StockProjector = {
  execute(input: ProjectProducibleQuantityInput): Promise<void>;
};

const missingPointOfSale = (error: unknown): boolean =>
  error instanceof Error &&
  error.message === "The venue has no point-of-sale location.";

export class ProjectAffectedProducts {
  constructor(
    private readonly project: (tenantId: string) => StockProjector,
    private readonly venuesSuppliedBy: (
      tenantId: string,
      warehouseLocationId: string,
    ) => Promise<readonly string[]> = () => Promise.resolve([]),
  ) {}

  async afterReceipt(input: StockReceipt): Promise<void> {
    const venueIds =
      input.venueId === null
        ? [...(await this.venuesSuppliedBy(input.tenantId, input.locationId))]
        : [input.venueId];
    const ingredientIds = [...new Set(input.ingredientIds)];

    for (const venueId of venueIds) {
      for (const ingredientId of ingredientIds) {
        try {
          await this.project(input.tenantId).execute({
            kind: "stock",
            tenantId: input.tenantId,
            siteId: venueId,
            locationId: input.locationId,
            ingredientId,
          });
        } catch (error: unknown) {
          if (missingPointOfSale(error)) {
            continue;
          }

          throw error;
        }
      }
    }
  }
}
