import type { Clock } from "#application/ports/clock.js";
import type { MenuRepository } from "#application/ports/menu-repository.js";
import type {
  QrOrderIntentRepository,
  StoredQrIntentLine,
  StoredQrOrderIntent,
} from "#application/ports/qr-order-intent-repository.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import type { Menu } from "#domain/menu.js";
import {
  QR_INTENT_NONE,
  type QrIntentCommand,
  type QrIntentLine,
  type QrIntentNone,
  QrOrderIntent,
} from "#domain/qr-order-intent.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export class QrProductUnavailable extends Error {
  constructor() {
    super("The dish is sold out.");
    this.name = "QrProductUnavailable";
  }
}

export interface RecordQrOrderIntentInput extends QrIntentCommand {
  tenantId: string;
  venueId: string;
  tableId: string;
}

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

const priceLine = (
  line: QrIntentLine,
  view: ReturnType<Menu["viewAt"]>,
): StoredQrIntentLine => {
  const product = view.products.find((item) => item.id === line.productId);

  if (!product?.orderable) {
    throw new QrProductUnavailable();
  }

  let unitPrice = product.price;

  for (const modifierId of line.modifierIds) {
    const modifier = product.modifiers.find((item) => item.id === modifierId);

    if (modifier === undefined) {
      throw new QrProductUnavailable();
    }

    unitPrice += modifier.price;
  }

  return {
    productId: line.productId,
    name: product.name,
    variantIds: [...line.variantIds],
    modifierIds: [...line.modifierIds],
    ...(line.note === undefined ? {} : { note: line.note }),
    unitPrice,
  };
};

export class RecordQrOrderIntent {
  constructor(
    private readonly intents: QrOrderIntentRepository,
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: RecordQrOrderIntentInput,
  ): Promise<StoredQrOrderIntent | QrIntentNone> {
    const received = QrOrderIntent.receive(input);

    if (received === QR_INTENT_NONE) {
      return QR_INTENT_NONE;
    }

    const existing = await this.intents.find(input.tenantId, received.id);

    if (existing !== null) {
      return existing;
    }

    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      throw new QrProductUnavailable();
    }

    const menu = await this.menus.load(input.tenantId, brandId);

    if (menu === null) {
      throw new QrProductUnavailable();
    }

    const view = menu.viewAt({
      venueId: input.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
    const stored: StoredQrOrderIntent = {
      id: received.id,
      tenantId: input.tenantId,
      venueId: input.venueId,
      tableId: input.tableId,
      status: received.status,
      lines: received.lines.map((line) => priceLine(line, view)),
      unavailableProductIds: [],
      sentLineIds: [],
      checkId: null,
      createdAt: new Date(this.clock.now()).toISOString(),
    };

    await this.intents.insert(stored);

    return stored;
  }
}
