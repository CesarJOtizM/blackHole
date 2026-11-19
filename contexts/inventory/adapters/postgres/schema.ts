import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";

export const ingredients = pgTable(
  "ingredients",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    baseUnit: text("base_unit").notNull(),
    referenceCostCop: integer("reference_cost_cop").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.brandId, table.version, table.id],
    }),
  ],
);

export const unitConversions = pgTable(
  "unit_conversions",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
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
        table.version,
        table.ingredientId,
        table.purpose,
      ],
    }),
  ],
);

export const recipes = pgTable(
  "recipes",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
    outputQuantity: integer("output_quantity"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.brandId, table.id] }),
  ],
);

export const recipeLines = pgTable(
  "recipe_lines",
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
    stocked: boolean("stocked"),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.brandId, table.recipeId, table.position],
    }),
  ],
);

export const recipeVersions = pgTable(
  "recipe_versions",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    recipeId: text("recipe_id").notNull(),
    authorId: text("author_id").notNull(),
    name: text("name").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
    outputQuantity: integer("output_quantity"),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.brandId, table.version, table.recipeId],
    }),
  ],
);

export const recipeVersionLines = pgTable(
  "recipe_version_lines",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    recipeId: text("recipe_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    ingredientId: text("ingredient_id"),
    subRecipeId: text("sub_recipe_id"),
    netQuantity: integer("net_quantity").notNull(),
    yieldPercent: integer("yield_percent").notNull(),
    stocked: boolean("stocked"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.brandId,
        table.version,
        table.recipeId,
        table.position,
      ],
    }),
  ],
);

export const modifierDeltas = pgTable(
  "modifier_deltas",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    modifierId: text("modifier_id").notNull(),
    modifierName: text("modifier_name").notNull(),
    position: integer("position").notNull(),
    ingredientId: text("ingredient_id"),
    quantity: integer("quantity"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.brandId,
        table.version,
        table.modifierId,
        table.position,
      ],
    }),
  ],
);

export const stockMovements = pgTable(
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

export const stockBalances = pgTable(
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

export const negativeStockAlerts = pgTable(
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

export const stockMovementOutbox = pgTable(
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

export const pointOfSaleLocations = pgTable(
  "point_of_sale_locations",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.venueId] })],
);

export const recipePublications = pgTable(
  "recipe_publications",
  {
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    version: integer("version").notNull(),
    authorId: text("author_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.brandId, table.version],
    }),
  ],
);

export const producibleIngredientIndex = pgTable(
  "producible_ingredient_index",
  {
    tenantId: text("tenant_id").notNull(),
    siteId: text("site_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.siteId,
        table.ingredientId,
        table.productId,
        table.variantId,
      ],
    }),
  ],
);

export const producibleQuantities = pgTable(
  "producible_quantities",
  {
    tenantId: text("tenant_id").notNull(),
    siteId: text("site_id").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    pointUnits: integer("point_units").notNull(),
    replenishmentUnits: integer("replenishment_units").notNull(),
    state: text("state").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.siteId, table.productId, table.variantId],
    }),
  ],
);

export const producibleLimitingIngredients = pgTable(
  "producible_limiting_ingredients",
  {
    tenantId: text("tenant_id").notNull(),
    siteId: text("site_id").notNull(),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    position: integer("position").notNull(),
    ingredientId: text("ingredient_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tenantId,
        table.siteId,
        table.productId,
        table.variantId,
        table.position,
      ],
    }),
  ],
);

export const productionRuns = pgTable(
  "production_runs",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    recipeVersion: integer("recipe_version").notNull(),
    expectedQuantity: integer("expected_quantity").notNull(),
    actualQuantity: integer("actual_quantity").notNull(),
    variance: integer("variance").notNull(),
    outputUnitCost: integer("output_unit_cost"),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

export const productionCostPolicies = pgTable(
  "production_cost_policies",
  {
    tenantId: text("tenant_id").notNull(),
    costRule: text("cost_rule").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId] })],
);

export const preparationStandardCosts = pgTable(
  "preparation_standard_costs",
  {
    tenantId: text("tenant_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    standardUnitCost: integer("standard_unit_cost").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.recipeId] })],
);

export const countSessions = pgTable(
  "count_sessions",
  {
    tenantId: text("tenant_id").notNull(),
    documentId: text("document_id").notNull(),
    venueId: text("venue_id").notNull(),
    locationId: text("location_id").notNull(),
    cutOff: text("cut_off").notNull(),
    status: text("status").notNull(),
    valueCop: integer("value_cop").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.documentId] })],
);

export const countSessionLines = pgTable(
  "count_session_lines",
  {
    tenantId: text("tenant_id").notNull(),
    documentId: text("document_id").notNull(),
    position: integer("position").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    quantity: integer("quantity").notNull(),
    averageCost: integer("average_cost").notNull(),
    valueCop: integer("value_cop").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentId, table.ingredientId],
    }),
  ],
);

export const ingredientClassifications = pgTable(
  "ingredient_classifications",
  {
    tenantId: text("tenant_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    category: text("category").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.ingredientId] })],
);

