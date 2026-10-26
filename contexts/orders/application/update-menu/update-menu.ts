import type { MenuRepository } from "#application/ports/menu-repository.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import { Menu, type VenuePrice } from "#domain/menu.js";

const MENU_COMMAND = {
  PUBLISH_PRODUCT: "publishProduct",
  PUBLISH_COMBO: "publishCombo",
  SET_VENUE_PRICE: "setVenuePrice",
} as const;

interface ProductVariant {
  id: string;
  name: string;
}

interface ProductModifier {
  id: string;
  name: string;
  price: number;
}

interface PublishProductCommand {
  type: typeof MENU_COMMAND.PUBLISH_PRODUCT;
  id: string;
  name: string;
  price: number;
  taxClassification: string;
  variants?: readonly ProductVariant[];
  modifiers?: readonly ProductModifier[];
}

interface PublishComboCommand {
  type: typeof MENU_COMMAND.PUBLISH_COMBO;
  id: string;
  name: string;
  price: number;
  componentIds: readonly string[];
}

interface SetVenuePriceCommand extends VenuePrice {
  type: typeof MENU_COMMAND.SET_VENUE_PRICE;
}

export type MenuCommand =
  | PublishProductCommand
  | PublishComboCommand
  | SetVenuePriceCommand;

export interface UpdateMenuInput {
  tenantId: string;
  brandId: string;
  command: MenuCommand;
}

export class ForeignVenue extends Error {
  constructor() {
    super("The venue does not belong to this brand.");
    this.name = "ForeignVenue";
  }
}

const assertNever = (command: never): never => {
  throw command;
};

const applyCommand = (menu: Menu, command: MenuCommand): void => {
  switch (command.type) {
    case MENU_COMMAND.PUBLISH_PRODUCT:
      menu.publishProduct({
        id: command.id,
        name: command.name,
        price: command.price,
        taxClassification: command.taxClassification,
        variants: command.variants,
        modifiers: command.modifiers,
      });
      return;
    case MENU_COMMAND.PUBLISH_COMBO:
      menu.publishCombo({
        id: command.id,
        name: command.name,
        price: command.price,
        componentIds: command.componentIds,
      });
      return;
    case MENU_COMMAND.SET_VENUE_PRICE:
      menu.setVenuePrice({
        venueId: command.venueId,
        itemId: command.itemId,
        price: command.price,
        available: command.available,
        ...(command.window ? { window: { ...command.window } } : {}),
      });
      return;
    default:
      assertNever(command);
  }
};

const openMenu = (input: UpdateMenuInput): Menu =>
  Menu.open({
    id: `menu_${input.brandId}`,
    tenantId: input.tenantId,
    brandId: input.brandId,
  });

export class UpdateMenu {
  constructor(
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
  ) {}

  async execute(input: UpdateMenuInput): Promise<Menu> {
    const loaded = await this.menus.load(input.tenantId, input.brandId);
    const menu = loaded ?? openMenu(input);

    if (input.command.type === MENU_COMMAND.SET_VENUE_PRICE) {
      await this.assertSameBrand(
        input.tenantId,
        menu.brandId,
        input.command.venueId,
      );
    }

    applyCommand(menu, input.command);
    await this.menus.save(menu);

    return menu;
  }

  private async assertSameBrand(
    tenantId: string,
    brandId: string,
    venueId: string,
  ): Promise<void> {
    const venueBrand = await this.venues.brandOf(tenantId, venueId);

    if (venueBrand !== brandId) {
      throw new ForeignVenue();
    }
  }
}
