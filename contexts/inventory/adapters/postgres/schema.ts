import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
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
