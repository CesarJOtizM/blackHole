import {
  integer,
  primaryKey,
  sqliteTable,
  text,
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
