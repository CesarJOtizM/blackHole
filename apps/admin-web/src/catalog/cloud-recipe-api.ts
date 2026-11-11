const SESSION_HEADER = "x-session-id";

export const CATALOG_COMMAND = {
  UPSERT_INGREDIENT: "upsertIngredient",
  UPSERT_RECIPE: "upsertRecipe",
} as const;

export const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

export const BASE_UNIT = {
  GRAM: "g",
  MILLILITRE: "ml",
  UNIT: "unit",
} as const;

export type BaseUnit = (typeof BASE_UNIT)[keyof typeof BASE_UNIT];
export type LineKind = (typeof LINE_KIND)[keyof typeof LINE_KIND];

export interface CatalogScope {
  tenantId: string;
  brandId: string;
  sessionId: string;
}

export interface CatalogUnitCommand {
  name: string;
  baseQuantity: number;
}

export interface UpsertIngredientCommand {
  type: typeof CATALOG_COMMAND.UPSERT_INGREDIENT;
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: CatalogUnitCommand;
  recipeUnit: CatalogUnitCommand;
  referenceCostCop: number;
}

export interface IngredientLineCommand {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent?: number;
}

export interface SubRecipeLineCommand {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent?: number;
  stocked: boolean;
}

export type RecipeLineCommand = IngredientLineCommand | SubRecipeLineCommand;

export interface UpsertRecipeCommand {
  type: typeof CATALOG_COMMAND.UPSERT_RECIPE;
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: RecipeLineCommand[];
}

export type CatalogCommand = UpsertIngredientCommand | UpsertRecipeCommand;

export interface CloudResult {
  status: number;
  body: unknown;
}

export interface StoredUnitView {
  name: string;
  factor: number;
}

export interface IngredientView {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnit: StoredUnitView;
  recipeUnit: StoredUnitView;
  referenceCostCop: number;
}

export interface IngredientLineView {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent: number;
}

export interface SubRecipeLineView {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent: number;
  stocked: boolean;
}

export type RecipeLineView = IngredientLineView | SubRecipeLineView;

export interface RecipeView {
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: RecipeLineView[];
}

export interface PublicationView {
  version: number;
  authorId: string;
  ingredients: IngredientView[];
  recipes: RecipeView[];
}

export interface CatalogView {
  publications: PublicationView[];
}

export interface RecipeCostView {
  costCop: number;
  marginPercent: number;
}

export interface ImportRowView {
  row: number;
  reason: string;
}

export interface IngredientForm {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnitName: string;
  purchaseBaseQuantity: string;
  recipeUnitName: string;
  recipeBaseQuantity: string;
  referenceCostCop: string;
}

export interface LineDraft {
  key: string;
  kind: string;
  targetId: string;
  netQuantity: string;
  yieldPercent: string;
  stocked: boolean;
}

export interface RecipeForm {
  id: string;
  name: string;
  productId: string;
  variantId: string;
  lines: readonly LineDraft[];
}

export function catalogQueryKey(scope: CatalogScope | null) {
  if (scope === null) {
    return ["recipe-catalog"] as const;
  }

  return [
    "recipe-catalog",
    scope.tenantId,
    scope.brandId,
    scope.sessionId,
  ] as const;
}

export function getRecipeCatalog(scope: CatalogScope): Promise<CloudResult> {
  return cloudRequest(catalogPath(scope), scope.sessionId);
}

export function publishCatalog(
  scope: CatalogScope,
  commands: readonly CatalogCommand[],
): Promise<CloudResult> {
  return cloudRequest(catalogPath(scope), scope.sessionId, { commands });
}

export function importWorkbook(
  scope: CatalogScope,
  contents: string,
): Promise<CloudResult> {
  return cloudRequest(`${catalogPath(scope)}/import`, scope.sessionId, {
    contents,
  });
}

export function getRecipeCost(
  scope: CatalogScope,
  venueId: string,
  productId: string,
  variantId: string,
): Promise<CloudResult> {
  const params = new URLSearchParams();

  if (variantId.length > 0) {
    params.set("variantId", variantId);
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const path = `/tenants/${encodeURIComponent(scope.tenantId)}/venues/${encodeURIComponent(venueId)}/recipes/${encodeURIComponent(productId)}/cost${query}`;

  return cloudRequest(path, scope.sessionId);
}

export async function fileContentsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    const codes: number[] = [];

    for (const byte of chunk) {
      codes.push(byte);
    }

    binary += String.fromCharCode(...codes);
  }

  return btoa(binary);
}

export function upsertIngredientCommand(
  draft: IngredientForm,
): UpsertIngredientCommand | null {
  const id = draft.id.trim();
  const name = draft.name.trim();
  const purchaseName = draft.purchaseUnitName.trim();
  const recipeName = draft.recipeUnitName.trim();
  const purchaseBaseQuantity = parseInteger(draft.purchaseBaseQuantity);
  const recipeBaseQuantity = parseInteger(draft.recipeBaseQuantity);
  const referenceCostCop = parseInteger(draft.referenceCostCop);

  if (
    id.length === 0 ||
    name.length === 0 ||
    !isBaseUnit(draft.baseUnit) ||
    purchaseName.length === 0 ||
    recipeName.length === 0 ||
    purchaseBaseQuantity === null ||
    recipeBaseQuantity === null ||
    referenceCostCop === null
  ) {
    return null;
  }

  return {
    type: CATALOG_COMMAND.UPSERT_INGREDIENT,
    id,
    name,
    baseUnit: draft.baseUnit,
    purchaseUnit: { name: purchaseName, baseQuantity: purchaseBaseQuantity },
    recipeUnit: { name: recipeName, baseQuantity: recipeBaseQuantity },
    referenceCostCop,
  };
}

export function upsertRecipeCommand(
  draft: RecipeForm,
): UpsertRecipeCommand | null {
  const id = draft.id.trim();
  const name = draft.name.trim();
  const productId = draft.productId.trim();
  const variantId = draft.variantId.trim();

  if (id.length === 0 || name.length === 0 || productId.length === 0) {
    return null;
  }

  if (draft.lines.length === 0) {
    return null;
  }

  const lines: RecipeLineCommand[] = [];

  for (const line of draft.lines) {
    const command = lineCommand(line);

    if (command === null) {
      return null;
    }

    lines.push(command);
  }

  return {
    type: CATALOG_COMMAND.UPSERT_RECIPE,
    id,
    name,
    productId,
    ...(variantId.length > 0 ? { variantId } : {}),
    lines,
  };
}

export function catalogFromPayload(payload: unknown): CatalogView | null {
  if (!isRecord(payload) || !Array.isArray(payload.publications)) {
    return null;
  }

  const publications: PublicationView[] = [];

  for (const item of payload.publications) {
    const publication = publicationFromPayload(item);

    if (publication === null) {
      return null;
    }

    publications.push(publication);
  }

  return { publications };
}

export function publicationFromPayload(
  payload: unknown,
): PublicationView | null {
  if (!isRecord(payload) || !Array.isArray(payload.ingredients)) {
    return null;
  }

  if (!Array.isArray(payload.recipes)) {
    return null;
  }

  const version = readInt(payload.version);
  const authorId = readText(payload.authorId);

  if (version === null || authorId === null) {
    return null;
  }

  const ingredients: IngredientView[] = [];

  for (const item of payload.ingredients) {
    const ingredient = readIngredient(item);

    if (ingredient === null) {
      return null;
    }

    ingredients.push(ingredient);
  }

  const recipes: RecipeView[] = [];

  for (const item of payload.recipes) {
    const recipe = readRecipe(item);

    if (recipe === null) {
      return null;
    }

    recipes.push(recipe);
  }

  return { version, authorId, ingredients, recipes };
}

export function latestPublication(
  catalog: CatalogView,
): PublicationView | null {
  let latest: PublicationView | null = null;

  for (const publication of catalog.publications) {
    if (latest === null || publication.version > latest.version) {
      latest = publication;
    }
  }

  return latest;
}

export function recipeCostFromPayload(payload: unknown): RecipeCostView | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    !Object.hasOwn(payload, "costCop") ||
    !Object.hasOwn(payload, "marginPercent")
  ) {
    return null;
  }

  const { costCop, marginPercent } = payload;

  if (!isFiniteNumber(costCop) || !isFiniteNumber(marginPercent)) {
    return null;
  }

  return { costCop, marginPercent };
}

export function importRowsFromPayload(payload: unknown): ImportRowView[] {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) {
    return [];
  }

  const rows: ImportRowView[] = [];

  for (const item of payload.rows) {
    if (!isRecord(item)) {
      continue;
    }

    const row = readInt(item.row);
    const reason = readText(item.reason);

    if (row === null || reason === null) {
      continue;
    }

    rows.push({ row, reason });
  }

  return rows;
}

export function errorNameFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readText(payload.error);
}

export function actionMessage(result: CloudResult): string {
  if (result.status === 200) {
    const publication = publicationFromPayload(result.body);

    if (publication === null) {
      return "Publicado.";
    }

    return `Versión ${publication.version} publicada.`;
  }

  return errorNameFromPayload(result.body) ?? "La nube rechazó el cambio.";
}

export function isBaseUnit(value: string): value is BaseUnit {
  return (
    value === BASE_UNIT.GRAM ||
    value === BASE_UNIT.MILLILITRE ||
    value === BASE_UNIT.UNIT
  );
}

function catalogPath(scope: CatalogScope): string {
  return `/tenants/${encodeURIComponent(scope.tenantId)}/brands/${encodeURIComponent(scope.brandId)}/recipe-catalog`;
}

async function cloudRequest(
  path: string,
  sessionId: string,
  body?: unknown,
): Promise<CloudResult> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      [SESSION_HEADER]: sessionId,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return { status: response.status, body: await readBody(response) };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function lineCommand(line: LineDraft): RecipeLineCommand | null {
  const targetId = line.targetId.trim();
  const netQuantity = parseInteger(line.netQuantity);
  const yieldText = line.yieldPercent.trim();
  const yieldPercent =
    yieldText.length === 0 ? undefined : parseInteger(yieldText);

  if (targetId.length === 0 || netQuantity === null || yieldPercent === null) {
    return null;
  }

  const yieldField = yieldPercent === undefined ? {} : { yieldPercent };

  if (line.kind === LINE_KIND.INGREDIENT) {
    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId: targetId,
      netQuantity,
      ...yieldField,
    };
  }

  if (line.kind === LINE_KIND.RECIPE) {
    return {
      kind: LINE_KIND.RECIPE,
      recipeId: targetId,
      netQuantity,
      stocked: line.stocked,
      ...yieldField,
    };
  }

  return null;
}

function readIngredient(value: unknown): IngredientView | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readText(value.id);
  const name = readText(value.name);
  const baseUnit = readText(value.baseUnit);
  const purchaseUnit = readStoredUnit(value.purchaseUnit);
  const recipeUnit = readStoredUnit(value.recipeUnit);
  const referenceCostCop = readInt(value.referenceCostCop);

  if (
    id === null ||
    name === null ||
    baseUnit === null ||
    purchaseUnit === null ||
    recipeUnit === null ||
    referenceCostCop === null
  ) {
    return null;
  }

  return {
    id,
    name,
    baseUnit,
    purchaseUnit,
    recipeUnit,
    referenceCostCop,
  };
}

function readRecipe(value: unknown): RecipeView | null {
  if (!isRecord(value) || !Array.isArray(value.lines)) {
    return null;
  }

  const id = readText(value.id);
  const name = readText(value.name);
  const productId = readText(value.productId);

  if (id === null || name === null || productId === null) {
    return null;
  }

  if (value.variantId !== undefined && typeof value.variantId !== "string") {
    return null;
  }

  const lines: RecipeLineView[] = [];

  for (const item of value.lines) {
    const line = readLine(item);

    if (line === null) {
      return null;
    }

    lines.push(line);
  }

  const variantId = readText(value.variantId);

  return {
    id,
    name,
    productId,
    ...(variantId === null ? {} : { variantId }),
    lines,
  };
}

function readLine(value: unknown): RecipeLineView | null {
  if (!isRecord(value)) {
    return null;
  }

  const netQuantity = readInt(value.netQuantity);
  const yieldPercent = readInt(value.yieldPercent);

  if (netQuantity === null || yieldPercent === null) {
    return null;
  }

  if (value.kind === LINE_KIND.INGREDIENT) {
    const ingredientId = readText(value.ingredientId);

    if (ingredientId === null) {
      return null;
    }

    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId,
      netQuantity,
      yieldPercent,
    };
  }

  if (value.kind === LINE_KIND.RECIPE && typeof value.stocked === "boolean") {
    const recipeId = readText(value.recipeId);

    if (recipeId === null) {
      return null;
    }

    return {
      kind: LINE_KIND.RECIPE,
      recipeId,
      netQuantity,
      yieldPercent,
      stocked: value.stocked,
    };
  }

  return null;
}

function readStoredUnit(value: unknown): StoredUnitView | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readText(value.name);
  const factor = readInt(value.factor);

  if (name === null || factor === null) {
    return null;
  }

  return { name, factor };
}

function parseInteger(value: string): number | null {
  const trimmed = value.trim();

  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function readInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
