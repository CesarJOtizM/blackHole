import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const recipeCopies = sqliteTable(
  "recipe_copies",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    authorId: text("author_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.brandId] })],
);

export const recipeCopyIngredients = sqliteTable(
  "recipe_copy_ingredients",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    position: integer("position").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    baseUnit: text("base_unit").notNull(),
    referenceCostCop: integer("reference_cost_cop").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.brandId, table.id] }),
  ],
);

export const recipeCopyUnits = sqliteTable(
  "recipe_copy_units",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    purpose: text("purpose").notNull(),
    name: text("name").notNull(),
    factor: integer("factor").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.brandId,
        table.ingredientId,
        table.purpose,
      ],
    }),
  ],
);

export const recipeCopyRecipes = sqliteTable(
  "recipe_copy_recipes",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    position: integer("position").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.brandId, table.id] }),
  ],
);

export const recipeCopyLines = sqliteTable(
  "recipe_copy_lines",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    ingredientId: text("ingredient_id"),
    subRecipeId: text("sub_recipe_id"),
    netQuantity: integer("net_quantity").notNull(),
    yieldPercent: integer("yield_percent").notNull(),
    stocked: integer("stocked", { mode: "boolean" }),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.brandId, table.recipeId, table.position],
    }),
  ],
);

export const recipeCopyModifiers = sqliteTable(
  "recipe_copy_modifiers",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    position: integer("position").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.brandId, table.id] }),
  ],
);

export const recipeCopyDeltas = sqliteTable(
  "recipe_copy_deltas",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    modifierId: text("modifier_id").notNull(),
    position: integer("position").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.brandId,
        table.modifierId,
        table.position,
      ],
    }),
  ],
);

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
    movementType: text("movement_type").notNull(),
    reference: text("reference").notNull(),
    occurredAt: text("occurred_at").notNull(),
    orderLineId: text("order_line_id").notNull(),
    role: text("role").notNull(),
    recipeVersion: integer("recipe_version").notNull(),
    reason: text("reason"),
    actorId: text("actor_id"),
    reversesMovementId: text("reverses_movement_id"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("stock_movements_line").on(
      table.tenantId,
      table.orderLineId,
      table.role,
      table.ingredientId,
    ),
  ],
);

export const stockBalances = sqliteTable(
  "stock_balances",
  {
    tenantId: text("tenant_id").notNull(),
    locationId: text("location_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.locationId, table.ingredientId],
    }),
  ],
);

export const negativeStockAlerts = sqliteTable(
  "negative_stock_alerts",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    balance: integer("balance").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.locationId, table.ingredientId],
    }),
  ],
);

export const stockMovementOutbox = sqliteTable(
  "stock_movement_outbox",
  {
    tenantId: text("tenant_id").notNull(),
    movementId: text("movement_id").notNull(),
    position: integer("position").notNull(),
    lane: text("lane").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
    movementType: text("movement_type").notNull(),
    orderLineId: text("order_line_id").notNull(),
    recipeVersion: integer("recipe_version").notNull(),
    occurredAt: text("occurred_at").notNull(),
    role: text("role").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.movementId] })],
);

export const pointOfSaleLocations = sqliteTable(
  "point_of_sale_locations",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.venueId] })],
);
