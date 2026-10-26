import type { Clock } from "#application/ports/clock.js";
import type { MenuRepository } from "#application/ports/menu-repository.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import type { Menu } from "#domain/menu.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export interface ViewVenueMenuInput {
  tenantId: string;
  venueId: string;
}

type VenueMenuView = ReturnType<Menu["viewAt"]>;

const bogotaMinute = (instant: number): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return `${hour}:${minute}`;
};

export class ViewVenueMenu {
  constructor(
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
    private readonly clock: Clock,
  ) {}

  async execute(input: ViewVenueMenuInput): Promise<VenueMenuView | null> {
    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      return null;
    }

    const menu = await this.menus.load(input.tenantId, brandId);

    if (menu === null) {
      return null;
    }

    return menu.viewAt({
      venueId: input.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
  }
}
