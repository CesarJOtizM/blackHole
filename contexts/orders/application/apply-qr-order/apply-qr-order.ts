import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { MenuRepository } from "#application/ports/menu-repository.js";
import type {
  QrOrderIntentRepository,
  StoredQrOrderIntent,
} from "#application/ports/qr-order-intent-repository.js";
import type { TableQrRepository } from "#application/ports/table-qr-repository.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import {
  ProductNotOrderable,
  type TakeOrder,
} from "#application/take-order/take-order.js";
import { Check, TableNotOpen } from "#domain/check.js";
import type { Menu } from "#domain/menu.js";
import type { QrIntentStatus } from "#domain/qr-order-intent.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export class QrIntentMissing extends Error {
  constructor() {
    super("The QR order intent does not exist.");
    this.name = "QrIntentMissing";
  }
}

export interface ApplyQrOrderInput {
  tenantId: string;
  intentId: string;
  force?: boolean;
}

export interface AppliedQrOrder {
  intentId: string;
  status: QrIntentStatus;
  checkId: string | null;
  lineIds: readonly string[];
  unavailableProductIds: readonly string[];
}

export const toAppliedQrOrder = (
  intent: StoredQrOrderIntent,
): AppliedQrOrder => ({
  intentId: intent.id,
  status: intent.status,
  checkId: intent.checkId,
  lineIds: [...intent.sentLineIds],
  unavailableProductIds: [...intent.unavailableProductIds],
});

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

const unavailableIds = (
  intent: StoredQrOrderIntent,
  view: ReturnType<Menu["viewAt"]>,
): string[] =>
  intent.lines.flatMap((line) => {
    const product = view.products.find((item) => item.id === line.productId);

    return product?.orderable ? [] : [line.productId];
  });

export class ApplyQrOrder {
  constructor(
    private readonly intents: QrOrderIntentRepository,
    private readonly dining: DiningRoomRepository,
    private readonly tokens: TableQrRepository,
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
    private readonly ordering: TakeOrder,
    private readonly clock: Clock,
  ) {}

  async execute(input: ApplyQrOrderInput): Promise<AppliedQrOrder> {
    const intent = await this.intents.find(input.tenantId, input.intentId);

    if (intent === null) {
      throw new QrIntentMissing();
    }

    if (intent.status !== "pending_acceptance") {
      return toAppliedQrOrder(intent);
    }

    const settings = await this.tokens.loadSettings(
      intent.tenantId,
      intent.venueId,
    );

    if (settings.acceptance !== "direct" && input.force !== true) {
      return toAppliedQrOrder(intent);
    }

    const brandId = await this.venues.brandOf(intent.tenantId, intent.venueId);
    const menu =
      brandId === null ? null : await this.menus.load(intent.tenantId, brandId);

    if (brandId === null || menu === null) {
      throw new ProductNotOrderable();
    }

    const view = menu.viewAt({
      venueId: intent.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
    const missing = unavailableIds(intent, view);
    const table = await this.dining.load(
      intent.tenantId,
      intent.venueId,
      intent.tableId,
    );

    if (table === null || table.state === "to_clean") {
      const rejected: StoredQrOrderIntent = {
        ...intent,
        status: "rejected",
        unavailableProductIds: missing,
      };
      await this.intents.save(rejected);

      return toAppliedQrOrder(rejected);
    }

    const orderId = `order_${intent.id}`;
    const lines = intent.lines.flatMap((line, index) => {
      if (missing.includes(line.productId)) {
        return [];
      }

      return [
        {
          orderId,
          lineId: `line_${intent.id}_${index}`,
          productId: line.productId,
          name: line.name,
          course: 1,
          channel: "qr_table" as const,
          variantIds: [...line.variantIds],
          modifierIds: [...line.modifierIds],
          ...(line.note === undefined ? {} : { note: line.note }),
        },
      ];
    });

    if (lines.length === 0) {
      const rejected: StoredQrOrderIntent = {
        ...intent,
        status: "rejected",
        unavailableProductIds: missing,
      };
      await this.intents.save(rejected);

      return toAppliedQrOrder(rejected);
    }

    const checkId = await this.openOrJoin(table, intent);

    await this.ordering.execute({
      tenantId: intent.tenantId,
      brandId,
      venueId: intent.venueId,
      checkId,
      course: 1,
      lines,
    });

    const applied: StoredQrOrderIntent = {
      ...intent,
      status: "applied",
      checkId,
      sentLineIds: lines.map((line) => line.lineId),
      unavailableProductIds: missing,
    };
    await this.intents.save(applied);

    return toAppliedQrOrder(applied);
  }

  private async openOrJoin(
    table: NonNullable<Awaited<ReturnType<DiningRoomRepository["load"]>>>,
    intent: StoredQrOrderIntent,
  ): Promise<string> {
    if (table.state === "free") {
      const checkId = `check_${intent.id}`;
      table.open({ diners: 1 });
      const check = Check.open({
        id: checkId,
        tenantId: intent.tenantId,
        venueId: intent.venueId,
        tableId: intent.tableId,
        openedAt: new Date(this.clock.now()).toISOString(),
      });
      await this.dining.save(table);
      await this.dining.saveCheck(check);

      return checkId;
    }

    const open = await this.dining.loadOpenCheckByTable(
      intent.tenantId,
      intent.venueId,
      intent.tableId,
    );

    if (open === null) {
      throw new TableNotOpen();
    }

    return open.id;
  }
}
