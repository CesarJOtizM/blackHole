import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";

import type { CreatePurchaseOrder } from "#application/create-purchase-order/create-purchase-order.js";
import { ShortageAlertNotFound } from "#application/mark-alert-seen/mark-alert-seen.js";
import type { ShortageAudit } from "#application/ports/shortage-audit.js";
import {
  ALERT_DOCUMENT_KIND,
  type AlertDocumentKind,
  type ShortageRepository,
  type ShortageTransaction,
} from "#application/ports/shortage-repository.js";
import type { SupplyingLocations } from "#application/ports/supplying-locations.js";
import type { TransferRequest } from "#application/ports/transfer-request.js";
import { roundUpRestock } from "#domain/shortage-alert.js";

const ACTION = "inventory.restock-from-alert";

export class RestockDenied extends Error {
  constructor() {
    super("Only inventory.request-replenishment may restock from an alert.");
    this.name = "RestockDenied";
  }
}

export class WarehouseChoiceRequired extends Error {
  constructor() {
    super("Several supplying warehouses require the actor's warehouse id.");
    this.name = "WarehouseChoiceRequired";
  }
}

export interface RestockFromAlertInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  alertId: string;
  sessionId: string;
  actorId: string;
  purchaseUnit: number;
  documentId: string;
  lineId: string;
  warehouseId: string | null;
  supplierId: string | null;
}

export type RestockFromAlertResult =
  | {
      readonly outcome: "transfer";
      readonly documentId: string;
      readonly quantity: number;
      readonly destinationLocationId: string;
    }
  | {
      readonly outcome: "purchase-order";
      readonly documentId: string;
      readonly quantity: number;
    }
  | {
      readonly outcome: "purchase-offered";
      readonly quantity: number;
    };

const present = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
};

export class RestockFromAlert {
  constructor(
    private readonly shortages: ShortageRepository,
    private readonly permissions: EvaluatePermission,
    private readonly supplying: SupplyingLocations,
    private readonly transfers: TransferRequest,
    private readonly orders: CreatePurchaseOrder,
    private readonly audits: ShortageAudit,
  ) {}

  async execute(
    tx: ShortageTransaction,
    input: RestockFromAlertInput,
  ): Promise<RestockFromAlertResult> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_REQUEST_REPLENISHMENT,
      target: {
        kind: "site",
        id: input.venueId,
        brandId: input.brandId,
      },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new RestockDenied();
    }

    const alert = await this.shortages.findLevelAlert(
      input.tenantId,
      input.alertId,
      tx,
    );

    if (!alert) {
      throw new ShortageAlertNotFound();
    }

    const levels = await this.shortages.effectiveLevels(
      {
        tenantId: alert.tenantId,
        brandId: alert.brandId,
        venueId: alert.venueId,
        locationId: alert.locationId,
        ingredientId: alert.ingredientId,
      },
      tx,
    );
    const onHand = await tx.balance(
      alert.tenantId,
      alert.locationId,
      alert.ingredientId,
    );

    if (!levels) {
      throw new ShortageAlertNotFound();
    }

    const quantity = roundUpRestock({
      maximum: levels.maximum,
      onHand,
      purchaseUnit: input.purchaseUnit,
    });
    const links = [
      ...(await this.supplying.locationIds(input.tenantId, input.venueId)),
    ];
    const only = links[0];

    if (links.length === 1 && only !== undefined) {
      return this.transfer(input, alert.ingredientId, only, quantity);
    }

    if (links.length > 1) {
      const warehouseId = present(input.warehouseId);

      if (warehouseId === null || !links.includes(warehouseId)) {
        throw new WarehouseChoiceRequired();
      }

      return this.transfer(input, alert.ingredientId, warehouseId, quantity);
    }

    const supplierId = present(input.supplierId);

    if (supplierId === null) {
      return { outcome: "purchase-offered", quantity };
    }

    const order = await this.orders.execute({
      tenantId: input.tenantId,
      id: input.documentId,
      supplierId,
      locationId: alert.locationId,
      lines: [
        {
          id: input.lineId,
          ingredientId: alert.ingredientId,
          purchaseQuantity: quantity / input.purchaseUnit,
          factor: input.purchaseUnit,
        },
      ],
    });
    await this.remember(
      input,
      order.id,
      ALERT_DOCUMENT_KIND.PURCHASE_ORDER,
      quantity,
    );

    return {
      outcome: "purchase-order",
      documentId: order.id,
      quantity,
    };
  }

  private async transfer(
    input: RestockFromAlertInput,
    ingredientId: string,
    destinationLocationId: string,
    quantity: number,
  ): Promise<RestockFromAlertResult> {
    const documentId = await this.transfers.request({
      tenantId: input.tenantId,
      destinationLocationId,
      lines: [{ ingredientId, quantity }],
      alertId: input.alertId,
    });
    await this.remember(
      input,
      documentId,
      ALERT_DOCUMENT_KIND.TRANSFER,
      quantity,
    );

    return {
      outcome: "transfer",
      documentId,
      quantity,
      destinationLocationId,
    };
  }

  private async remember(
    input: RestockFromAlertInput,
    documentId: string,
    kind: AlertDocumentKind,
    quantity: number,
  ): Promise<void> {
    const after = { documentId, kind, quantity };
    await this.shortages.saveAlertDocument({
      tenantId: input.tenantId,
      alertId: input.alertId,
      documentId,
      kind,
    });
    await this.audits.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: ACTION,
      entity: input.alertId,
      before: null,
      after,
      reason: ACTION,
    });
  }
}
