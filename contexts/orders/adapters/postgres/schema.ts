import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";

export const menus = pgTable(
  "menus",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("menus_tenant_brand").on(table.tenantId, table.brandId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    taxClassification: text("tax_classification").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.menuId, table.id] }),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.menuId, table.id] }),
  ],
);

export const modifiers = pgTable(
  "modifiers",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.menuId, table.id] }),
  ],
);

export const combos = pgTable(
  "combos",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.menuId, table.id] }),
  ],
);

export const comboComponents = pgTable(
  "combo_components",
  {
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    comboId: text("combo_id").notNull(),
    productId: text("product_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.menuId, table.comboId, table.position],
    }),
  ],
);

export const venuePrices = pgTable(
  "venue_prices",
  {
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    venueId: text("venue_id").notNull(),
    itemId: text("item_id").notNull(),
    price: integer("price").notNull(),
    available: boolean("available").notNull(),
    windowStart: text("window_start"),
    windowEnd: text("window_end"),
    lowUnitsThreshold: integer("low_units_threshold"),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.menuId, table.venueId, table.itemId],
    }),
  ],
);

export const menuInventoryStates = pgTable(
  "menu_inventory_states",
  {
    tenantId: text("tenant_id").notNull(),
    menuId: text("menu_id").notNull(),
    venueId: text("venue_id").notNull(),
    productId: text("product_id").notNull(),
    state: text("state").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.menuId, table.venueId, table.productId],
    }),
  ],
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    zone: text("zone").notNull(),
    state: text("state").notNull(),
    diners: integer("diners").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.venueId, table.id] }),
  ],
);

export const checks = pgTable(
  "checks",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    tableId: text("table_id").notNull(),
    openedAt: text("opened_at").notNull(),
    waiterId: text("waiter_id"),
    diners: integer("diners"),
    releasedAt: text("released_at"),
    chargedAt: text("charged_at"),
    firstSentAt: text("first_sent_at"),
    tableState: text("table_state").notNull(),
    preBillRequestedAt: text("pre_bill_requested_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.venueId, table.id] }),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    checkId: text("check_id").notNull(),
    channel: text("channel").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.venueId, table.id] }),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    checkId: text("check_id").notNull(),
    orderId: text("order_id").notNull(),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    course: integer("course").notNull(),
    price: integer("price").notNull(),
    state: text("state").notNull(),
    originTableId: text("origin_table_id").notNull(),
    note: text("note"),
    variantIds: jsonb("variant_ids").notNull().$type<readonly string[]>(),
    modifierIds: jsonb("modifier_ids").notNull().$type<readonly string[]>(),
    sentAt: text("sent_at"),
    inPreparationAt: text("in_preparation_at"),
    readyAt: text("ready_at"),
    deliveredAt: text("delivered_at"),
    stationId: text("station_id"),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.venueId, table.id] }),
  ],
);

export const stationRoutes = pgTable(
  "station_routes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    name: text("name").notNull(),
    output: text("output").notNull(),
    redThresholdMinutes: integer("red_threshold_minutes").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.venueId, table.id] }),
  ],
);

export const tableQrTokens = pgTable(
  "table_qr_tokens",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    tableId: text("table_id").notNull(),
    digest: text("digest").notNull(),
    retired: boolean("retired").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.digest] }),
    unique("table_qr_tokens_digest").on(table.digest),
  ],
);

export const qrTableSettings = pgTable(
  "qr_table_settings",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    acceptance: text("acceptance").notNull().default("direct"),
    staleAfterSeconds: integer("stale_after_seconds").notNull().default(900),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.venueId] })],
);

export const qrOrderIntents = pgTable(
  "qr_order_intents",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    tableId: text("table_id").notNull(),
    status: text("status").notNull(),
    lines: jsonb("lines").notNull().$type<
      {
        productId: string;
        name: string;
        variantIds: readonly string[];
        modifierIds: readonly string[];
        note?: string;
        unitPrice: number;
      }[]
    >(),
    unavailableProductIds: jsonb("unavailable_product_ids")
      .notNull()
      .$type<string[]>(),
    sentLineIds: jsonb("sent_line_ids").notNull().$type<string[]>(),
    checkId: text("check_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("qr_order_intents_id").on(table.id),
  ],
);

export const stationRouteProducts = pgTable(
  "station_route_products",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    stationId: text("station_id").notNull(),
    productId: text("product_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.venueId, table.productId],
    }),
  ],
);
