import {
  boolean,
  integer,
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
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.menuId, table.venueId, table.itemId],
    }),
  ],
);
