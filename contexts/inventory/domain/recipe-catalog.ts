export const BASE_UNIT = {
  GRAM: "g",
  MILLILITRE: "ml",
  UNIT: "unit",
} as const;

export type BaseUnit = (typeof BASE_UNIT)[keyof typeof BASE_UNIT];

export const QUANTITY_SCALE = 1000;

const CATALOG_ID_PREFIX = "recipe_catalog_";
const DEFAULT_YIELD_PERCENT = 100;

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

const BASE_UNITS = new Set<string>(Object.values(BASE_UNIT));

interface UnitQuantity {
  name: string;
  baseQuantity: number;
}

interface StoredUnit {
  name: string;
  factor: number;
}

export interface IngredientView {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: StoredUnit;
  recipeUnit: StoredUnit;
  referenceCostCop: number;
}

interface UpsertIngredient {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: UnitQuantity;
  recipeUnit: UnitQuantity;
  referenceCostCop: number;
}

interface IngredientLineInput {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent?: number;
}

interface SubRecipeLineInput {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent?: number;
  stocked: boolean;
}

type RecipeLineInput = IngredientLineInput | SubRecipeLineInput;

interface UpsertRecipe {
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: readonly RecipeLineInput[];
}

interface ModifierDeltaInput {
  ingredientId: string;
  quantity: number;
}

interface UpsertModifier {
  id: string;
  name: string;
  deltas: readonly ModifierDeltaInput[];
}

interface ConvertPurchase {
  ingredientId: string;
  quantity: number;
}

interface ExplodeRecipe {
  productId: string;
  variantId?: string;
  version?: number;
  modifierIds?: readonly string[];
}

export interface ExplodedQuantity {
  ingredientId: string;
  quantity: number;
}

interface IngredientLineView {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent: number;
}

interface SubRecipeLineView {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent: number;
  stocked: boolean;
}

type RecipeLineView = IngredientLineView | SubRecipeLineView;

export interface RecipeView {
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: readonly RecipeLineView[];
}

interface ModifierDeltaView {
  ingredientId: string;
  quantity: number;
}

export interface ModifierView {
  id: string;
  name: string;
  deltas: readonly ModifierDeltaView[];
}

export interface PublishedVersion {
  number: number;
  authorId: string;
  ingredients: readonly IngredientView[];
  recipes: readonly RecipeView[];
  modifiers: readonly ModifierView[];
}

interface OpenCatalog {
  id: string;
  tenantId: string;
  brandId: string;
}

interface PublishCatalog {
  authorId: string;
}

interface StoredIngredient {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: StoredUnit;
  recipeUnit: StoredUnit;
  referenceCostCop: number;
}

interface StoredIngredientLine {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent: number;
}

interface StoredSubRecipeLine {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent: number;
  stocked: boolean;
}

type StoredLine = StoredIngredientLine | StoredSubRecipeLine;

interface StoredRecipe {
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: StoredLine[];
}

interface StoredModifier {
  id: string;
  name: string;
  deltas: ModifierDeltaView[];
}

interface Draft {
  ingredients: Map<string, StoredIngredient>;
  recipes: Map<string, StoredRecipe>;
  modifiers: Map<string, StoredModifier>;
}

interface StoredVersion {
  number: number;
  authorId: string;
  draft: Draft;
}

export class InvalidRecipeCatalogId extends Error {
  constructor() {
    super("A recipe catalog identifier must be recipe_catalog_<brandId>.");
    this.name = "InvalidRecipeCatalogId";
  }
}

export class ZeroUnitFactor extends Error {
  readonly unitName: string;

  constructor(unitName: string) {
    super(`The conversion factor for ${unitName} must not be zero.`);
    this.name = "ZeroUnitFactor";
    this.unitName = unitName;
  }
}

export class InvalidReferenceCost extends Error {
  constructor() {
    super("A reference cost must be a whole number of COP.");
    this.name = "InvalidReferenceCost";
  }
}

export class InvalidQuantity extends Error {
  constructor() {
    super("A quantity must be a whole number of base units.");
    this.name = "InvalidQuantity";
  }
}

export class InvalidYield extends Error {
  constructor() {
    super("A yield percent must be a positive whole number.");
    this.name = "InvalidYield";
  }
}

export class UnknownIngredient extends Error {
  constructor() {
    super("The catalog does not contain that ingredient.");
    this.name = "UnknownIngredient";
  }
}

export class UnknownRecipe extends Error {
  constructor() {
    super("The catalog does not contain that recipe.");
    this.name = "UnknownRecipe";
  }
}

export class UnknownModifier extends Error {
  constructor() {
    super("The catalog does not contain that modifier.");
    this.name = "UnknownModifier";
  }
}

export class UnknownRecipeVersion extends Error {
  constructor() {
    super("That recipe version was not published.");
    this.name = "UnknownRecipeVersion";
  }
}

export class RecipeCycle extends Error {
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Recipe cycle: ${cycle.join(" → ")}.`);
    this.name = "RecipeCycle";
    this.cycle = cycle;
  }
}

function assertCatalogId(id: string, brandId: string): void {
  if (brandId.length === 0 || id !== `${CATALOG_ID_PREFIX}${brandId}`) {
    throw new InvalidRecipeCatalogId();
  }
}

function assertBaseUnit(baseUnit: string): asserts baseUnit is BaseUnit {
  if (!BASE_UNITS.has(baseUnit)) {
    throw new InvalidQuantity();
  }
}

function assertFactor(unit: UnitQuantity): void {
  if (unit.baseQuantity === 0) {
    throw new ZeroUnitFactor(unit.name);
  }

  if (!Number.isInteger(unit.baseQuantity) || unit.baseQuantity < 0) {
    throw new InvalidQuantity();
  }
}

function assertReferenceCost(referenceCostCop: number): void {
  if (!Number.isInteger(referenceCostCop) || referenceCostCop < 0) {
    throw new InvalidReferenceCost();
  }
}

function assertWholeQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new InvalidQuantity();
  }
}

function assertYield(yieldPercent: number): void {
  if (!Number.isInteger(yieldPercent) || yieldPercent <= 0) {
    throw new InvalidYield();
  }
}

function assertDelta(quantity: number): void {
  if (!Number.isInteger(quantity)) {
    throw new InvalidQuantity();
  }
}

function scale(baseUnits: number): number {
  return baseUnits * QUANTITY_SCALE;
}

function grossQuantity(netScaled: number, yieldPercent: number): number {
  return Math.floor((netScaled * 100) / yieldPercent);
}

function add(totals: Map<string, number>, id: string, quantity: number): void {
  totals.set(id, (totals.get(id) ?? 0) + quantity);
}

function emptyDraft(): Draft {
  return {
    ingredients: new Map(),
    recipes: new Map(),
    modifiers: new Map(),
  };
}

function cloneDraft(draft: Draft): Draft {
  return {
    ingredients: new Map(
      [...draft.ingredients].map(([id, ingredient]) => [
        id,
        {
          ...ingredient,
          purchaseUnit: { ...ingredient.purchaseUnit },
          recipeUnit: { ...ingredient.recipeUnit },
        },
      ]),
    ),
    recipes: new Map(
      [...draft.recipes].map(([id, recipe]) => [
        id,
        {
          ...recipe,
          lines: recipe.lines.map((line) => ({ ...line })),
        },
      ]),
    ),
    modifiers: new Map(
      [...draft.modifiers].map(([id, modifier]) => [
        id,
        {
          ...modifier,
          deltas: modifier.deltas.map((delta) => ({ ...delta })),
        },
      ]),
    ),
  };
}

function storeUnit(unit: UnitQuantity): StoredUnit {
  assertFactor(unit);

  return {
    name: unit.name,
    factor: scale(unit.baseQuantity),
  };
}

function storeLine(line: RecipeLineInput): StoredLine {
  const yieldPercent = line.yieldPercent ?? DEFAULT_YIELD_PERCENT;
  assertWholeQuantity(line.netQuantity);
  assertYield(yieldPercent);

  if (line.kind === LINE_KIND.INGREDIENT) {
    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId: line.ingredientId,
      netQuantity: scale(line.netQuantity),
      yieldPercent,
    };
  }

  return {
    kind: LINE_KIND.RECIPE,
    recipeId: line.recipeId,
    netQuantity: scale(line.netQuantity),
    yieldPercent,
    stocked: line.stocked,
  };
}

function lineView(line: StoredLine): RecipeLineView {
  if (line.kind === LINE_KIND.INGREDIENT) {
    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId: line.ingredientId,
      netQuantity: line.netQuantity,
      yieldPercent: line.yieldPercent,
    };
  }

  return {
    kind: LINE_KIND.RECIPE,
    recipeId: line.recipeId,
    netQuantity: line.netQuantity,
    yieldPercent: line.yieldPercent,
    stocked: line.stocked,
  };
}

function recipeView(recipe: StoredRecipe): RecipeView {
  const view = {
    id: recipe.id,
    name: recipe.name,
    productId: recipe.productId,
    lines: recipe.lines.map(lineView),
  };

  if (recipe.variantId === undefined) {
    return view;
  }

  return {
    ...view,
    variantId: recipe.variantId,
  };
}

function byId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function ingredientViews(draft: Draft): IngredientView[] {
  return [...draft.ingredients.values()]
    .map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      purchaseUnit: { ...ingredient.purchaseUnit },
      recipeUnit: { ...ingredient.recipeUnit },
      referenceCostCop: ingredient.referenceCostCop,
    }))
    .sort(byId);
}

function recipeViews(draft: Draft): RecipeView[] {
  return [...draft.recipes.values()].map(recipeView).sort(byId);
}

function modifierViews(draft: Draft): ModifierView[] {
  return [...draft.modifiers.values()]
    .map((modifier) => ({
      id: modifier.id,
      name: modifier.name,
      deltas: modifier.deltas.map((delta) => ({ ...delta })),
    }))
    .sort(byId);
}

function findCycle(
  recipes: readonly StoredRecipe[],
): readonly string[] | undefined {
  const byRecipeId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): readonly string[] | undefined => {
    if (visited.has(id)) {
      return undefined;
    }

    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id].map(
        (cycleId) => byRecipeId.get(cycleId)?.name ?? cycleId,
      );
    }

    visiting.add(id);
    stack.push(id);
    const recipe = byRecipeId.get(id);

    if (recipe) {
      for (const line of recipe.lines) {
        if (line.kind !== LINE_KIND.RECIPE) {
          continue;
        }

        const found = visit(line.recipeId);
        if (found) {
          return found;
        }
      }
    }

    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return undefined;
  };

  for (const recipe of recipes) {
    const found = visit(recipe.id);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function findRecipe(
  recipes: readonly StoredRecipe[],
  productId: string,
  variantId: string | undefined,
): StoredRecipe {
  if (variantId !== undefined) {
    const variant = recipes.find(
      (recipe) =>
        recipe.productId === productId && recipe.variantId === variantId,
    );

    if (variant) {
      return variant;
    }
  }

  const product = recipes.find(
    (recipe) =>
      recipe.productId === productId && recipe.variantId === undefined,
  );

  if (!product) {
    throw new UnknownRecipe();
  }

  return product;
}

function explodeRecipe(
  draft: Draft,
  recipeId: string,
  visiting: Set<string>,
): Map<string, number> {
  if (visiting.has(recipeId)) {
    const names = [...visiting, recipeId].map(
      (id) => draft.recipes.get(id)?.name ?? id,
    );
    throw new RecipeCycle(names);
  }

  const recipe = draft.recipes.get(recipeId);
  if (!recipe) {
    throw new UnknownRecipe();
  }

  visiting.add(recipeId);
  const totals = new Map<string, number>();

  for (const line of recipe.lines) {
    const gross = grossQuantity(line.netQuantity, line.yieldPercent);

    if (line.kind === LINE_KIND.INGREDIENT) {
      add(totals, line.ingredientId, gross);
      continue;
    }

    if (line.stocked) {
      add(totals, line.recipeId, gross);
      continue;
    }

    const child = explodeRecipe(draft, line.recipeId, visiting);
    for (const [ingredientId, quantity] of child) {
      add(
        totals,
        ingredientId,
        Math.floor((quantity * gross) / QUANTITY_SCALE),
      );
    }
  }

  visiting.delete(recipeId);
  return totals;
}

function explodedLines(totals: Map<string, number>): ExplodedQuantity[] {
  return [...totals.entries()]
    .map(([ingredientId, quantity]) => ({
      ingredientId,
      quantity: quantity < 0 ? 0 : quantity,
    }))
    .sort((left, right) => left.ingredientId.localeCompare(right.ingredientId));
}

export class RecipeCatalog {
  readonly id: string;
  readonly tenantId: string;
  readonly brandId: string;

  private readonly draft: Draft = emptyDraft();
  private readonly versions = new Map<number, StoredVersion>();
  private versionCount = 0;

  private constructor(id: string, tenantId: string, brandId: string) {
    this.id = id;
    this.tenantId = tenantId;
    this.brandId = brandId;
  }

  static open(input: OpenCatalog): RecipeCatalog {
    assertCatalogId(input.id, input.brandId);

    return new RecipeCatalog(input.id, input.tenantId, input.brandId);
  }

  get currentVersion(): number {
    return this.versionCount;
  }

  get ingredients(): readonly IngredientView[] {
    return ingredientViews(this.draft);
  }

  upsertIngredient(input: UpsertIngredient): void {
    assertBaseUnit(input.baseUnit);
    assertReferenceCost(input.referenceCostCop);
    const purchaseUnit = storeUnit(input.purchaseUnit);
    const recipeUnit = storeUnit(input.recipeUnit);

    this.draft.ingredients.set(input.id, {
      id: input.id,
      name: input.name,
      baseUnit: input.baseUnit,
      purchaseUnit,
      recipeUnit,
      referenceCostCop: input.referenceCostCop,
    });
  }

  upsertRecipe(input: UpsertRecipe): void {
    const lines = input.lines.map(storeLine);
    const recipe: StoredRecipe = {
      id: input.id,
      name: input.name,
      productId: input.productId,
      lines,
    };

    if (input.variantId !== undefined) {
      recipe.variantId = input.variantId;
    }

    this.draft.recipes.set(input.id, recipe);
  }

  upsertModifier(input: UpsertModifier): void {
    const deltas = input.deltas.map((delta) => {
      assertDelta(delta.quantity);

      return {
        ingredientId: delta.ingredientId,
        quantity: scale(delta.quantity),
      };
    });

    this.draft.modifiers.set(input.id, {
      id: input.id,
      name: input.name,
      deltas,
    });
  }

  convertPurchase(input: ConvertPurchase): number {
    assertWholeQuantity(input.quantity);
    const ingredient = this.draft.ingredients.get(input.ingredientId);

    if (!ingredient) {
      throw new UnknownIngredient();
    }

    return input.quantity * ingredient.purchaseUnit.factor;
  }

  publish(input: PublishCatalog): number {
    const cycle = findCycle([...this.draft.recipes.values()]);

    if (cycle) {
      throw new RecipeCycle(cycle);
    }

    const number = this.versionCount + 1;
    this.versions.set(number, {
      number,
      authorId: input.authorId,
      draft: cloneDraft(this.draft),
    });
    this.versionCount = number;
    return number;
  }

  publishedVersion(version: number): PublishedVersion {
    const published = this.version(version);

    return {
      number: published.number,
      authorId: published.authorId,
      ingredients: ingredientViews(published.draft),
      recipes: recipeViews(published.draft),
      modifiers: modifierViews(published.draft),
    };
  }

  explode(input: ExplodeRecipe): readonly ExplodedQuantity[] {
    const published = this.version(input.version ?? this.versionCount);
    const recipe = findRecipe(
      [...published.draft.recipes.values()],
      input.productId,
      input.variantId,
    );
    const totals = explodeRecipe(published.draft, recipe.id, new Set());

    for (const modifierId of input.modifierIds ?? []) {
      const modifier = published.draft.modifiers.get(modifierId);

      if (!modifier) {
        throw new UnknownModifier();
      }

      for (const delta of modifier.deltas) {
        add(totals, delta.ingredientId, delta.quantity);
      }
    }

    return explodedLines(totals);
  }

  private version(version: number): StoredVersion {
    const published = this.versions.get(version);

    if (!published) {
      throw new UnknownRecipeVersion();
    }

    return published;
  }
}
