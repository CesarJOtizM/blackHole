import type { OrganizationRepository } from "#application/ports/organization-repository.js";

export class UnlinkedWarehouse extends Error {
  constructor() {
    super("A site can declare only a warehouse that can supply it.");
    this.name = "UnlinkedWarehouse";
  }
}

export interface WarehouseSupplyLink {
  tenantId: string;
  venueId: string;
  warehouseLocationId: string;
}

export interface DeclareWarehouseSupplyInput {
  tenantId: string;
  venueId: string;
  warehouseLocationId: string;
}

export abstract class WarehouseSupplyStore {
  abstract save(link: WarehouseSupplyLink): Promise<void>;

  abstract find(
    tenantId: string,
    venueId: string,
    warehouseLocationId: string,
  ): Promise<WarehouseSupplyLink | null>;
}

const canSupply = (venueId: string, warehouseVenueId: string | null): boolean =>
  warehouseVenueId === null || warehouseVenueId === venueId;

export class DeclareWarehouseSupply {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly supplies: WarehouseSupplyStore,
  ) {}

  async execute(input: DeclareWarehouseSupplyInput): Promise<void> {
    const organization = await this.organizations.load(input.tenantId);
    const venue = organization?.venues.find(
      (item) => item.id === input.venueId,
    );
    const warehouse = organization?.locations.find(
      (location) => location.id === input.warehouseLocationId,
    );

    if (!venue || !warehouse || warehouse.kind !== "warehouse") {
      throw new UnlinkedWarehouse();
    }

    if (!canSupply(input.venueId, warehouse.venueId)) {
      throw new UnlinkedWarehouse();
    }

    await this.supplies.save({
      tenantId: input.tenantId,
      venueId: input.venueId,
      warehouseLocationId: input.warehouseLocationId,
    });
  }
}
