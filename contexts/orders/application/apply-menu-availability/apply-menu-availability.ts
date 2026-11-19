import type { MenuRepository } from "#application/ports/menu-repository.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import type { InventoryState, Menu } from "#domain/menu.js";

export interface ApplyMenuAvailabilityInput {
  tenantId: string;
  venueId: string;
  productId: string;
  variantId: string | null;
  state: InventoryState;
}

const VIEW_MINUTE = "00:00";

const currentState = (
  menu: Menu,
  venueId: string,
  productId: string,
): InventoryState | undefined =>
  menu
    .viewAt({ venueId, minute: VIEW_MINUTE })
    .products.find((product) => product.id === productId)?.inventoryState;

export class ApplyMenuAvailability {
  constructor(
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
    private readonly hub: RealtimeHub,
  ) {}

  async execute(input: ApplyMenuAvailabilityInput): Promise<void> {
    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      return;
    }

    const menu = await this.menus.load(input.tenantId, brandId);

    if (menu === null) {
      return;
    }

    if (currentState(menu, input.venueId, input.productId) === input.state) {
      return;
    }

    menu.setInventoryState({
      venueId: input.venueId,
      productId: input.productId,
      state: input.state,
    });
    await this.menus.save(menu);
    await this.hub.publish({
      kind: "availability_changed",
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
      variantId: input.variantId,
      state: input.state,
    });
  }
}
