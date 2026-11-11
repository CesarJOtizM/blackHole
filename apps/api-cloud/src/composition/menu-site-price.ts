import { SitePrice } from "@blackhole/inventory/application/ports/site-price";
import { ViewVenueMenu } from "@blackhole/orders/application/entry-port";
import type { Clock } from "@blackhole/orders/application/ports/clock";
import type { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import type { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";

export class MenuSitePrice extends SitePrice {
  constructor(
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
    private readonly clock: Clock,
  ) {
    super();
  }

  override async priceOf(
    tenantId: string,
    venueId: string,
    productId: string,
    variantId?: string,
  ): Promise<number | null> {
    const menu = await new ViewVenueMenu(
      this.menus,
      this.venues,
      this.clock,
    ).execute({ tenantId, venueId });

    if (menu === null) {
      return null;
    }

    const product = menu.products.find((item) => item.id === productId);

    if (product) {
      if (
        variantId !== undefined &&
        product.variants.length > 0 &&
        !product.variants.some((variant) => variant.id === variantId)
      ) {
        return null;
      }

      return product.price;
    }

    const combo = menu.combos.find((item) => item.id === productId);

    return combo?.price ?? null;
  }
}
