import { ComboNotSent } from "#domain/check.js";
import { InvalidMenuId } from "#domain/menu.js";

const STATION_ID_PREFIX = "station_";
const PRODUCT_ID_PREFIX = "menu_";

const STATION_OUTPUT = {
  SCREEN: "screen",
  PRINTER: "printer",
  BOTH: "both",
} as const;

const ITEM_KIND = {
  COMBO: "combo",
} as const;

export type StationOutput =
  (typeof STATION_OUTPUT)[keyof typeof STATION_OUTPUT];

interface OpenRouter {
  venueId: string;
}

interface AssignProduct {
  stationId: string;
  stationName: string;
  productId: string;
  output: string;
  kind?: string;
}

interface RouteProduct {
  productId: string;
  kind?: string;
}

interface StoredRoute {
  stationId: string;
  stationName: string;
  productId: string;
  output: StationOutput;
}

export interface RoutedProduct {
  stationId: string;
  stationName: string;
  productId: string;
  output: StationOutput;
  screen: boolean;
  printer: boolean;
  register: true;
}

export class MissingStation extends Error {
  constructor() {
    super("The product has no kitchen station.");
    this.name = "MissingStation";
  }
}

export class DuplicateStationProduct extends Error {
  constructor() {
    super("A product belongs to one kitchen station.");
    this.name = "DuplicateStationProduct";
  }
}

export class InvalidStationId extends Error {
  constructor() {
    super("A station identifier must use the station_ prefix.");
    this.name = "InvalidStationId";
  }
}

export class InvalidStationOutput extends Error {
  constructor() {
    super("A station output must be screen, printer, or both.");
    this.name = "InvalidStationOutput";
  }
}

function assertStationId(id: string): void {
  if (
    !id.startsWith(STATION_ID_PREFIX) ||
    id.length === STATION_ID_PREFIX.length
  ) {
    throw new InvalidStationId();
  }
}

function assertProductId(id: string): void {
  if (
    !id.startsWith(PRODUCT_ID_PREFIX) ||
    id.length === PRODUCT_ID_PREFIX.length
  ) {
    throw new InvalidMenuId();
  }
}

function assertProduct(kind: string | undefined): void {
  if (kind === ITEM_KIND.COMBO) {
    throw new ComboNotSent();
  }
}

function parseOutput(output: string): StationOutput {
  if (
    output === STATION_OUTPUT.SCREEN ||
    output === STATION_OUTPUT.PRINTER ||
    output === STATION_OUTPUT.BOTH
  ) {
    return output;
  }

  throw new InvalidStationOutput();
}

function selected(output: StationOutput): {
  screen: boolean;
  printer: boolean;
} {
  return {
    screen: output === STATION_OUTPUT.SCREEN || output === STATION_OUTPUT.BOTH,
    printer:
      output === STATION_OUTPUT.PRINTER || output === STATION_OUTPUT.BOTH,
  };
}

export class StationRouter {
  readonly venueId: string;

  private readonly routes = new Map<string, StoredRoute>();

  private constructor(input: OpenRouter) {
    this.venueId = input.venueId;
  }

  static open(input: OpenRouter): StationRouter {
    return new StationRouter(input);
  }

  assign(input: AssignProduct): void {
    assertStationId(input.stationId);
    assertProductId(input.productId);
    assertProduct(input.kind);

    const output = parseOutput(input.output);

    if (this.routes.has(input.productId)) {
      throw new DuplicateStationProduct();
    }

    this.routes.set(input.productId, {
      stationId: input.stationId,
      stationName: input.stationName,
      productId: input.productId,
      output,
    });
  }

  route(input: RouteProduct): RoutedProduct {
    assertProductId(input.productId);
    assertProduct(input.kind);

    const stored = this.routes.get(input.productId);

    if (!stored) {
      throw new MissingStation();
    }

    return {
      stationId: stored.stationId,
      stationName: stored.stationName,
      productId: stored.productId,
      output: stored.output,
      ...selected(stored.output),
      register: true,
    };
  }
}
