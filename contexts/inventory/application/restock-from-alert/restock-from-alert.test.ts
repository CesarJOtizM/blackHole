import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import { CreatePurchaseOrder } from "#application/create-purchase-order/create-purchase-order.js";
import { CreateSupplier } from "#application/create-supplier/create-supplier.js";
import type { ShortageTransaction } from "#application/ports/shortage-repository.js";
import {
  type AlertDocument,
  type BrandStockLevel,
  LEVEL_ALERT_STATUS,
  type LevelAlert,
  ShortageRepository,
} from "#application/ports/shortage-repository.js";
import { SupplyingLocations } from "#application/ports/supplying-locations.js";
import {
  TransferRequest,
  type TransferRequestCommand,
} from "#application/ports/transfer-request.js";
import {
  RestockDenied,
  RestockFromAlert,
  type RestockFromAlertInput,
  WarehouseChoiceRequired,
} from "#application/restock-from-alert/restock-from-alert.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  ESCALATION_CLOCK,
  LEVEL_SEVERITY,
  SHORTAGE_KIND,
} from "#domain/shortage-alert.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const SITE_A = "organization_venue_a";
const LOCATION_A = "inventory_location_a";
const WAREHOUSE_A = "inventory_location_warehouse_a";
const WAREHOUSE_B = "inventory_location_warehouse_b";
const BEEF_ID = "ingredient_beef";
const ALERT_ID = "level:beef";
const SESSION_ID = "session_kitchen_chief";
const ACTOR_ID = "user_kitchen_chief";
const PREFERRED_SUPPLIER = "supplier_preferred";
const ACTOR_SUPPLIER = "supplier_actor";
const ORDER_ID = "purchase_order_beef";
const LINE_ID = "line_beef";
const TRANSFER_ID = "transfer_beef";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const command = (
  patch: Partial<RestockFromAlertInput> = {},
): RestockFromAlertInput => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  alertId: ALERT_ID,
  sessionId: SESSION_ID,
  actorId: ACTOR_ID,
  purchaseUnit: kilograms(1),
  documentId: ORDER_ID,
  lineId: LINE_ID,
  warehouseId: null,
  supplierId: null,
  ...patch,
});

const beefAlert = (): LevelAlert => ({
  id: ALERT_ID,
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  venueId: SITE_A,
  locationId: LOCATION_A,
  ingredientId: BEEF_ID,
  kind: SHORTAGE_KIND.LEVEL,
  severity: LEVEL_SEVERITY.RED,
  soldOut: false,
  status: LEVEL_ALERT_STATUS.OPEN,
  escalationClock: ESCALATION_CLOCK.RED,
  seenBy: null,
  seenAt: null,
  resolvedBy: null,
  resolvedAt: null,
  reason: null,
});

const brandBeef = (): BrandStockLevel => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  ingredientId: BEEF_ID,
  maximum: kilograms(20),
  reorderPoint: kilograms(15),
  minimum: kilograms(8),
});

class ScriptedBalance implements ShortageTransaction {
  constructor(private readonly onHand: number) {}

  async balance(): Promise<number> {
    return this.onHand;
  }
}

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;

const allowed = (): Decision => ({
  outcome: "allowed",
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: PermissionInput[] = [];

  constructor(private readonly decision: Decision) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: PermissionInput) {
    this.inputs.push(input);
    return this.decision;
  }
}

class MemorySupply extends SupplyingLocations {
  constructor(private readonly ids: readonly string[]) {
    super();
  }

  async locationIds(): Promise<readonly string[]> {
    return this.ids;
  }
}

class MemoryTransfer extends TransferRequest {
  readonly commands: TransferRequestCommand[] = [];

  async request(transfer: TransferRequestCommand): Promise<string> {
    this.commands.push(transfer);
    return TRANSFER_ID;
  }
}

class MemoryAudit {
  readonly commands: Array<{
    action: string;
    entity: string;
    after: unknown;
  }> = [];

  async record(entry: {
    tenantId: string;
    actorId: string;
    authorizerId: string | null;
    deviceId: string;
    siteId: string;
    action: string;
    entity: string;
    before: unknown;
    after: unknown;
    reason: string;
  }): Promise<void> {
    this.commands.push({
      action: entry.action,
      entity: entry.entity,
      after: entry.after,
    });
  }
}

class MemoryShortageRepository extends ShortageRepository {
  private readonly brands = new Map<string, BrandStockLevel>();
  private readonly alerts = new Map<string, LevelAlert>();
  private document: AlertDocument | null = null;

  async saveBrandLevel(level: BrandStockLevel): Promise<void> {
    this.brands.set(
      `${level.tenantId}:${level.brandId}:${level.ingredientId}`,
      {
        ...level,
      },
    );
  }

  async saveSiteLevel(): Promise<void> {
    return undefined;
  }

  async findBrandLevel(
    tenantId: string,
    brandId: string,
    ingredientId: string,
  ): Promise<BrandStockLevel | null> {
    return this.brands.get(`${tenantId}:${brandId}:${ingredientId}`) ?? null;
  }

  async findSiteLevel(): Promise<null> {
    return null;
  }

  seed(alert: LevelAlert): void {
    this.alerts.set(alert.id, { ...alert });
  }

  override async findLevelAlert(
    tenantId: string,
    alertId: string,
  ): Promise<LevelAlert | null> {
    const found = this.alerts.get(alertId);

    if (!found || found.tenantId !== tenantId) {
      return null;
    }

    return { ...found };
  }

  override async saveAlertDocument(document: AlertDocument): Promise<void> {
    this.document = { ...document };
  }

  override async findAlertDocument(
    tenantId: string,
    alertId: string,
  ): Promise<AlertDocument | null> {
    if (
      !this.document ||
      this.document.tenantId !== tenantId ||
      this.document.alertId !== alertId
    ) {
      return null;
    }

    return { ...this.document };
  }
}

const suppliers = async (purchasing: InMemoryPurchasingRepository) => {
  const createSupplier = new CreateSupplier(purchasing);
  await createSupplier.execute({
    tenantId: TENANT_ID,
    id: PREFERRED_SUPPLIER,
    identification: "900111111",
    name: "Preferred Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });
  await createSupplier.execute({
    tenantId: TENANT_ID,
    id: ACTOR_SUPPLIER,
    identification: "900222222",
    name: "Actor Market",
    issuesEInvoices: false,
    leadTimeDays: 4,
  });
};

const harness = async (
  links: readonly string[],
  decision: Decision = allowed(),
) => {
  const shortages = new MemoryShortageRepository();
  const purchasing = new InMemoryPurchasingRepository();
  const permissions = new ScriptedPermission(decision);
  const supplying = new MemorySupply(links);
  const transfers = new MemoryTransfer();
  const orders = new CreatePurchaseOrder(purchasing);
  const audits = new MemoryAudit();
  const restock = new RestockFromAlert(
    shortages,
    permissions,
    supplying,
    transfers,
    orders,
    audits,
  );
  const tx = new ScriptedBalance(kilograms(4));
  await shortages.saveBrandLevel(brandBeef());
  shortages.seed(beefAlert());
  await suppliers(purchasing);
  return { shortages, purchasing, permissions, transfers, audits, restock, tx };
};

it("given beef at 4 kg with a 20 kg maximum and a 1 kg purchase unit, when one supply link exists, then a 16 kg request uses that link as the destination", async () => {
  const { shortages, purchasing, transfers, audits, restock, tx } =
    await harness([WAREHOUSE_A]);

  const result = await restock.execute(tx, command());

  expect(result).toEqual({
    outcome: "transfer",
    documentId: TRANSFER_ID,
    quantity: kilograms(16),
    destinationLocationId: WAREHOUSE_A,
  });
  expect(transfers.commands).toEqual([
    {
      tenantId: TENANT_ID,
      destinationLocationId: WAREHOUSE_A,
      lines: [{ ingredientId: BEEF_ID, quantity: kilograms(16) }],
      alertId: ALERT_ID,
    },
  ]);
  expect(await shortages.findAlertDocument(TENANT_ID, ALERT_ID)).toEqual({
    tenantId: TENANT_ID,
    alertId: ALERT_ID,
    documentId: TRANSFER_ID,
    kind: "transfer",
  });
  expect(audits.commands).toEqual([
    {
      action: "inventory.restock-from-alert",
      entity: ALERT_ID,
      after: {
        documentId: TRANSFER_ID,
        kind: "transfer",
        quantity: kilograms(16),
      },
    },
  ]);
  expect((await purchasing.load(TENANT_ID))?.orders ?? []).toEqual([]);
  expect(JSON.stringify(transfers.commands)).not.toContain(PREFERRED_SUPPLIER);
});

it("given several supply links and no actor warehouse, when restock is tapped, then the request is refused", async () => {
  const { transfers, purchasing, restock, tx } = await harness([
    WAREHOUSE_A,
    WAREHOUSE_B,
  ]);

  const attempt = restock.execute(tx, command());

  await expect(attempt).rejects.toThrow(WarehouseChoiceRequired);
  expect(transfers.commands).toEqual([]);
  expect((await purchasing.load(TENANT_ID))?.orders ?? []).toEqual([]);
});

it("given several supply links, when the actor names one warehouse, then that warehouse is the destination", async () => {
  const { transfers, restock, tx } = await harness([WAREHOUSE_A, WAREHOUSE_B]);

  const result = await restock.execute(
    tx,
    command({ warehouseId: WAREHOUSE_B }),
  );

  expect(result).toMatchObject({
    outcome: "transfer",
    destinationLocationId: WAREHOUSE_B,
    quantity: kilograms(16),
  });
  expect(transfers.commands[0]?.destinationLocationId).toBe(WAREHOUSE_B);
});

it("given a warehouse id outside the supply links, when restock is tapped, then the request is refused", async () => {
  const { transfers, restock, tx } = await harness([WAREHOUSE_A, WAREHOUSE_B]);

  const attempt = restock.execute(
    tx,
    command({ warehouseId: "inventory_location_other" }),
  );

  await expect(attempt).rejects.toThrow(WarehouseChoiceRequired);
  expect(transfers.commands).toEqual([]);
});

it("given no supply link and two suppliers, when restock is tapped without a supplier, then a purchase order is offered and neither supplier is chosen", async () => {
  const { shortages, purchasing, transfers, restock, tx } = await harness([]);

  const result = await restock.execute(tx, command());

  expect(result).toEqual({
    outcome: "purchase-offered",
    quantity: kilograms(16),
  });
  expect(transfers.commands).toEqual([]);
  expect((await purchasing.load(TENANT_ID))?.orders ?? []).toEqual([]);
  expect(await shortages.findAlertDocument(TENANT_ID, ALERT_ID)).toBeNull();
  expect(JSON.stringify(result)).not.toContain(PREFERRED_SUPPLIER);
});

it("given no supply link, when the actor passes a supplier, then that supplier's purchase order is stored", async () => {
  const { shortages, purchasing, transfers, restock, tx } = await harness([]);

  const result = await restock.execute(
    tx,
    command({ supplierId: ACTOR_SUPPLIER }),
  );

  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  expect(result).toEqual({
    outcome: "purchase-order",
    documentId: ORDER_ID,
    quantity: kilograms(16),
  });
  expect(stored?.supplierId).toBe(ACTOR_SUPPLIER);
  expect(stored?.locationId).toBe(LOCATION_A);
  expect(stored?.lines).toEqual([
    {
      id: LINE_ID,
      ingredientId: BEEF_ID,
      purchaseQuantity: 16,
      receivedQuantity: 0,
      factor: kilograms(1),
    },
  ]);
  expect(await shortages.findAlertDocument(TENANT_ID, ALERT_ID)).toEqual({
    tenantId: TENANT_ID,
    alertId: ALERT_ID,
    documentId: ORDER_ID,
    kind: "purchase-order",
  });
  expect(transfers.commands).toEqual([]);
  expect(
    (await purchasing.load(TENANT_ID))?.orders.some(
      (order) => order.supplierId === PREFERRED_SUPPLIER,
    ),
  ).toBe(false);
});

it("given a session without inventory.request-replenishment, when restock is tapped, then the change is rejected", async () => {
  const { permissions, transfers, purchasing, restock, tx } = await harness(
    [WAREHOUSE_A],
    denied(),
  );

  const attempt = restock.execute(tx, command());

  await expect(attempt).rejects.toThrow(RestockDenied);
  expect(permissions.inputs.map((input) => input.permission)).toEqual([
    PERMISSION.INVENTORY_REQUEST_REPLENISHMENT,
  ]);
  expect(transfers.commands).toEqual([]);
  expect((await purchasing.load(TENANT_ID))?.orders ?? []).toEqual([]);
});
