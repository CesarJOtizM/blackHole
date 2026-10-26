const MENU_ID_PREFIX = "menu_";

interface ProductVariant {
  id: string;
  name: string;
}

interface ProductModifier {
  id: string;
  name: string;
  price: number;
}

interface ListedProduct {
  id: string;
  name: string;
  price: number;
  taxClassification: string;
  variants: ProductVariant[];
  modifiers: ProductModifier[];
}

interface ListedCombo {
  id: string;
  name: string;
  price: number;
  componentIds: string[];
}

interface PublishProduct {
  id: string;
  name: string;
  price: number;
  taxClassification: string;
  variants?: readonly ProductVariant[];
  modifiers?: readonly ProductModifier[];
}

interface PublishCombo {
  id: string;
  name: string;
  price: number;
  componentIds: readonly string[];
}

interface AttachLine {
  productId: string;
  modifierIds: readonly string[];
}

interface VenueWindow {
  start: string;
  end: string;
}

export interface VenuePrice {
  venueId: string;
  itemId: string;
  price: number;
  available: boolean;
  window?: VenueWindow;
}

export class InvalidMenuId extends Error {
  constructor() {
    super("A menu identifier must use the menu_ prefix.");
    this.name = "InvalidMenuId";
  }
}

export class InvalidMenuPrice extends Error {
  constructor() {
    super("A menu price must be an integer number of COP.");
    this.name = "InvalidMenuPrice";
  }
}

export class MissingTaxClassification extends Error {
  constructor() {
    super("A sellable product must carry a tax classification.");
    this.name = "MissingTaxClassification";
  }
}

export class ForeignModifier extends Error {
  constructor() {
    super("A modifier cannot be attached to a product that does not own it.");
    this.name = "ForeignModifier";
  }
}

export class DuplicateMenuId extends Error {
  constructor() {
    super("A menu identifier is already in use.");
    this.name = "DuplicateMenuId";
  }
}

export class UnknownMenuReference extends Error {
  constructor() {
    super("The menu does not contain that product.");
    this.name = "UnknownMenuReference";
  }
}

function assertMenuId(id: string): void {
  if (!id.startsWith(MENU_ID_PREFIX) || id.length === MENU_ID_PREFIX.length) {
    throw new InvalidMenuId();
  }
}

function assertCop(price: number): void {
  if (!Number.isInteger(price) || price < 0) {
    throw new InvalidMenuPrice();
  }
}

function minuteOfDay(value: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return undefined;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function minuteWithin(minute: string, window: VenueWindow): boolean {
  const at = minuteOfDay(minute);
  const start = minuteOfDay(window.start);
  const end = minuteOfDay(window.end);

  if (
    at === undefined ||
    start === undefined ||
    end === undefined ||
    start > end
  ) {
    return false;
  }

  return at >= start && at <= end;
}

export class Menu {
  readonly id: string;
  readonly tenantId: string;
  readonly brandId: string;

  private readonly takenIds = new Set<string>();
  private readonly productList: ListedProduct[] = [];
  private readonly comboList: ListedCombo[] = [];
  private readonly venuePriceList: VenuePrice[] = [];

  private constructor(id: string, tenantId: string, brandId: string) {
    this.id = id;
    this.tenantId = tenantId;
    this.brandId = brandId;
    this.takenIds.add(id);
  }

  static open(input: { id: string; tenantId: string; brandId: string }): Menu {
    assertMenuId(input.id);

    return new Menu(input.id, input.tenantId, input.brandId);
  }

  get products(): readonly ListedProduct[] {
    return this.productList.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      taxClassification: product.taxClassification,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
      })),
      modifiers: product.modifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        price: modifier.price,
      })),
    }));
  }

  get combos(): readonly ListedCombo[] {
    return this.comboList.map((combo) => ({
      id: combo.id,
      name: combo.name,
      price: combo.price,
      componentIds: [...combo.componentIds],
    }));
  }

  get venuePrices(): readonly VenuePrice[] {
    return this.venuePriceList.map((venuePrice) => ({
      venueId: venuePrice.venueId,
      itemId: venuePrice.itemId,
      price: venuePrice.price,
      available: venuePrice.available,
      ...(venuePrice.window
        ? {
            window: {
              start: venuePrice.window.start,
              end: venuePrice.window.end,
            },
          }
        : {}),
    }));
  }

  publishProduct(input: PublishProduct): void {
    const variants = (input.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
    }));
    const modifiers = (input.modifiers ?? []).map((modifier) => ({
      id: modifier.id,
      name: modifier.name,
      price: modifier.price,
    }));
    const taxClassification = input.taxClassification.trim();
    const ids = [
      input.id,
      ...variants.map((variant) => variant.id),
      ...modifiers.map((modifier) => modifier.id),
    ];

    for (const id of ids) {
      assertMenuId(id);
    }

    assertCop(input.price);

    for (const modifier of modifiers) {
      assertCop(modifier.price);
    }

    if (taxClassification === "") {
      throw new MissingTaxClassification();
    }

    this.take(ids);
    this.productList.push({
      id: input.id,
      name: input.name,
      price: input.price,
      taxClassification,
      variants,
      modifiers,
    });
  }

  publishCombo(input: PublishCombo): void {
    assertMenuId(input.id);

    for (const componentId of input.componentIds) {
      assertMenuId(componentId);
    }

    assertCop(input.price);

    for (const componentId of input.componentIds) {
      this.productById(componentId);
    }

    this.take([input.id]);
    this.comboList.push({
      id: input.id,
      name: input.name,
      price: input.price,
      componentIds: [...input.componentIds],
    });
  }

  attachLine(input: AttachLine): void {
    assertMenuId(input.productId);

    for (const modifierId of input.modifierIds) {
      assertMenuId(modifierId);
    }

    const product = this.productById(input.productId);
    const owned = new Set(product.modifiers.map((modifier) => modifier.id));

    for (const modifierId of input.modifierIds) {
      if (!owned.has(modifierId)) {
        throw new ForeignModifier();
      }
    }
  }

  setVenuePrice(input: VenuePrice): void {
    assertMenuId(input.itemId);
    assertCop(input.price);
    this.sellableById(input.itemId);

    const stored: VenuePrice = {
      venueId: input.venueId,
      itemId: input.itemId,
      price: input.price,
      available: input.available,
      ...(input.window
        ? {
            window: {
              start: input.window.start,
              end: input.window.end,
            },
          }
        : {}),
    };
    const index = this.venuePriceList.findIndex(
      (price) =>
        price.venueId === input.venueId && price.itemId === input.itemId,
    );

    if (index === -1) {
      this.venuePriceList.push(stored);
      return;
    }

    this.venuePriceList[index] = stored;
  }

  quote(input: {
    venueId?: string;
    productId: string;
    modifierIds: readonly string[];
  }): number {
    assertMenuId(input.productId);

    for (const modifierId of input.modifierIds) {
      assertMenuId(modifierId);
    }

    const product = this.productById(input.productId);
    const base =
      input.venueId === undefined
        ? product.price
        : this.priceInForce(product.id, product.price, input.venueId);
    let total = base;

    for (const modifierId of input.modifierIds) {
      const modifier = product.modifiers.find((item) => item.id === modifierId);

      if (!modifier) {
        throw new ForeignModifier();
      }

      total += modifier.price;
    }

    return total;
  }

  viewAt(input: { venueId: string; minute: string }) {
    return {
      products: this.productList.map((product) =>
        this.presentProduct(product, input.venueId, input.minute),
      ),
      combos: this.comboList.map((combo) => ({
        id: combo.id,
        name: combo.name,
        price: this.priceInForce(combo.id, combo.price, input.venueId),
        componentIds: [...combo.componentIds],
        orderable: this.isComboOrderable(combo, input.venueId, input.minute),
      })),
    };
  }

  private take(ids: readonly string[]): void {
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id) || this.takenIds.has(id)) {
        throw new DuplicateMenuId();
      }

      seen.add(id);
    }

    for (const id of seen) {
      this.takenIds.add(id);
    }
  }

  private productById(id: string): ListedProduct {
    const product = this.productList.find((item) => item.id === id);

    if (!product) {
      throw new UnknownMenuReference();
    }

    return product;
  }

  private sellableById(id: string): { price: number } {
    const product = this.productList.find((item) => item.id === id);

    if (product) {
      return product;
    }

    const combo = this.comboList.find((item) => item.id === id);

    if (combo) {
      return combo;
    }

    throw new UnknownMenuReference();
  }

  private venuePriceFor(
    venueId: string,
    itemId: string,
  ): VenuePrice | undefined {
    return this.venuePriceList.find(
      (price) => price.venueId === venueId && price.itemId === itemId,
    );
  }

  private priceInForce(
    itemId: string,
    brandPrice: number,
    venueId: string,
  ): number {
    return this.venuePriceFor(venueId, itemId)?.price ?? brandPrice;
  }

  private isOrderable(
    itemId: string,
    venueId: string,
    minute: string,
  ): boolean {
    const override = this.venuePriceFor(venueId, itemId);

    if (!override) {
      return true;
    }

    if (!override.available) {
      return false;
    }

    if (override.window && !minuteWithin(minute, override.window)) {
      return false;
    }

    return true;
  }

  private isComboOrderable(
    combo: ListedCombo,
    venueId: string,
    minute: string,
  ): boolean {
    if (!this.isOrderable(combo.id, venueId, minute)) {
      return false;
    }

    return combo.componentIds.every((componentId) =>
      this.isOrderable(componentId, venueId, minute),
    );
  }

  private presentProduct(
    product: ListedProduct,
    venueId: string,
    minute: string,
  ) {
    return {
      id: product.id,
      name: product.name,
      price: this.priceInForce(product.id, product.price, venueId),
      taxClassification: product.taxClassification,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
      })),
      modifiers: product.modifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        price: modifier.price,
      })),
      orderable: this.isOrderable(product.id, venueId, minute),
    };
  }
}
