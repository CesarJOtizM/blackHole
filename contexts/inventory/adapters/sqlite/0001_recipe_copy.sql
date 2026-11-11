-- Node copy of the last published recipe catalog. These tables are not the
-- cloud catalog. A missed publication writes nothing, so the last copy stays.
-- An older or repeated version does not replace it. No stock tables.

CREATE TABLE recipe_copies (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  version integer NOT NULL,
  author_id text NOT NULL,
  PRIMARY KEY (tenant_id, brand_id),
  CONSTRAINT recipe_copies_version CHECK (version >= 1)
);

CREATE TABLE recipe_copy_ingredients (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  position integer NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  base_unit text NOT NULL,
  reference_cost_cop integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, id),
  CONSTRAINT recipe_copy_ingredients_position CHECK (position >= 0),
  CONSTRAINT recipe_copy_ingredients_base_unit CHECK (base_unit IN ('g', 'ml', 'unit')),
  CONSTRAINT recipe_copy_ingredients_reference_cost CHECK (reference_cost_cop >= 0)
);

CREATE TABLE recipe_copy_units (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  ingredient_id text NOT NULL,
  purpose text NOT NULL,
  name text NOT NULL,
  factor integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, ingredient_id, purpose),
  CONSTRAINT recipe_copy_units_purpose CHECK (purpose IN ('purchase', 'recipe')),
  CONSTRAINT recipe_copy_units_factor CHECK (factor > 0)
);

CREATE TABLE recipe_copy_recipes (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  position integer NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  product_id text NOT NULL,
  variant_id text,
  PRIMARY KEY (tenant_id, brand_id, id),
  CONSTRAINT recipe_copy_recipes_position CHECK (position >= 0)
);

CREATE TABLE recipe_copy_lines (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  recipe_id text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  ingredient_id text,
  sub_recipe_id text,
  net_quantity integer NOT NULL,
  yield_percent integer NOT NULL,
  stocked integer,
  PRIMARY KEY (tenant_id, brand_id, recipe_id, position),
  CONSTRAINT recipe_copy_lines_position CHECK (position >= 0),
  CONSTRAINT recipe_copy_lines_quantity CHECK (net_quantity >= 0),
  CONSTRAINT recipe_copy_lines_yield CHECK (yield_percent > 0),
  CONSTRAINT recipe_copy_lines_kind CHECK (
    (
      kind = 'ingredient'
      AND ingredient_id IS NOT NULL
      AND sub_recipe_id IS NULL
      AND stocked IS NULL
    )
    OR (
      kind = 'recipe'
      AND ingredient_id IS NULL
      AND sub_recipe_id IS NOT NULL
      AND stocked IN (0, 1)
    )
  )
);

CREATE TABLE recipe_copy_modifiers (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  position integer NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, id),
  CONSTRAINT recipe_copy_modifiers_position CHECK (position >= 0)
);

CREATE TABLE recipe_copy_deltas (
  tenant_id text NOT NULL,
  brand_id text NOT NULL,
  modifier_id text NOT NULL,
  position integer NOT NULL,
  ingredient_id text NOT NULL,
  quantity integer NOT NULL,
  PRIMARY KEY (tenant_id, brand_id, modifier_id, position),
  CONSTRAINT recipe_copy_deltas_position CHECK (position >= 0)
);
