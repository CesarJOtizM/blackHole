import {
  RecipeWorkbook,
  type RecipeWorkbookSheet,
  WORKBOOK_LINE_KIND,
  type WorkbookIngredient,
  type WorkbookLine,
  type WorkbookUnit,
} from "@blackhole/inventory/application/ports/recipe-workbook";
import { BASE_UNIT, type BaseUnit } from "@blackhole/inventory/domain";
import * as XLSX from "xlsx";

const INGREDIENT_SHEET = "ingredients";
const RECIPE_SHEET = "recipes";

const INGREDIENT_COLUMNS = [
  "id",
  "name",
  "baseUnit",
  "purchaseUnit",
  "purchaseBaseQuantity",
  "recipeUnit",
  "recipeBaseQuantity",
  "referenceCostCop",
] as const;

const RECIPE_COLUMNS = [
  "recipeId",
  "recipeName",
  "productId",
  "kind",
  "ingredientId",
  "subRecipeId",
  "stocked",
  "netQuantity",
  "yieldPercent",
] as const;

const BASE_UNITS = new Set<string>(Object.values(BASE_UNIT));

export class ExcelRecipeWorkbookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelRecipeWorkbookError";
  }
}

const text = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
};

const whole = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value);
  }

  return null;
};

const flag = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return null;
};

const isBaseUnit = (value: string): value is BaseUnit => BASE_UNITS.has(value);

const blank = (row: readonly unknown[]): boolean =>
  row.every((value) => text(value) === "");

const gridOf = (book: XLSX.WorkBook, name: string): unknown[][] => {
  const sheet = book.Sheets[name];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
    defval: null,
    raw: true,
  });
};

const columnIndex = (
  header: readonly unknown[],
  name: string,
): number | undefined => {
  const index = header.findIndex((cell) => text(cell) === name);

  return index < 0 ? undefined : index;
};

const columns = (
  header: readonly unknown[],
  names: readonly string[],
  sheet: string,
): Map<string, number> => {
  const found = new Map<string, number>();

  for (const name of names) {
    const index = columnIndex(header, name);

    if (index === undefined) {
      throw new ExcelRecipeWorkbookError(
        `The ${sheet} sheet is missing ${name}.`,
      );
    }

    found.set(name, index);
  }

  return found;
};

const cell = (row: readonly unknown[], index: number): unknown => row[index];

const requiredText = (value: unknown, row: number, name: string): string => {
  const parsed = text(value);

  if (parsed === "") {
    throw new ExcelRecipeWorkbookError(`Row ${row} is missing ${name}.`);
  }

  return parsed;
};

const requiredWhole = (value: unknown, row: number, name: string): number => {
  const parsed = whole(value);

  if (parsed === null) {
    throw new ExcelRecipeWorkbookError(`Row ${row} has an invalid ${name}.`);
  }

  return parsed;
};

const unitOf = (
  row: readonly unknown[],
  nameIndex: number,
  quantityIndex: number,
  excelRow: number,
  label: string,
): WorkbookUnit => ({
  name: requiredText(cell(row, nameIndex), excelRow, label),
  baseQuantity: requiredWhole(cell(row, quantityIndex), excelRow, label),
});

const ingredientsOf = (grid: unknown[][]): WorkbookIngredient[] => {
  if (grid.length === 0) {
    return [];
  }

  const header = columns(grid[0] ?? [], INGREDIENT_COLUMNS, INGREDIENT_SHEET);
  const ingredients: WorkbookIngredient[] = [];

  for (let index = 1; index < grid.length; index += 1) {
    const row = grid[index] ?? [];

    if (blank(row)) {
      continue;
    }

    const excelRow = index + 1;
    const baseUnit = requiredText(
      cell(row, header.get("baseUnit") ?? 0),
      excelRow,
      "baseUnit",
    );

    if (!isBaseUnit(baseUnit)) {
      throw new ExcelRecipeWorkbookError(
        `Row ${excelRow} has an unknown base unit.`,
      );
    }

    ingredients.push({
      row: excelRow,
      id: requiredText(cell(row, header.get("id") ?? 0), excelRow, "id"),
      name: requiredText(cell(row, header.get("name") ?? 0), excelRow, "name"),
      baseUnit,
      purchaseUnit: unitOf(
        row,
        header.get("purchaseUnit") ?? 0,
        header.get("purchaseBaseQuantity") ?? 0,
        excelRow,
        "purchaseUnit",
      ),
      recipeUnit: unitOf(
        row,
        header.get("recipeUnit") ?? 0,
        header.get("recipeBaseQuantity") ?? 0,
        excelRow,
        "recipeUnit",
      ),
      referenceCostCop: requiredWhole(
        cell(row, header.get("referenceCostCop") ?? 0),
        excelRow,
        "referenceCostCop",
      ),
    });
  }

  return ingredients;
};

const linesOf = (grid: unknown[][]): WorkbookLine[] => {
  if (grid.length === 0) {
    return [];
  }

  const header = columns(grid[0] ?? [], RECIPE_COLUMNS, RECIPE_SHEET);
  const variantColumn = columnIndex(grid[0] ?? [], "variantId");
  const lines: WorkbookLine[] = [];

  for (let index = 1; index < grid.length; index += 1) {
    const row = grid[index] ?? [];

    if (blank(row)) {
      continue;
    }

    const excelRow = index + 1;
    const kind = requiredText(
      cell(row, header.get("kind") ?? 0),
      excelRow,
      "kind",
    );
    const variant =
      variantColumn === undefined ? "" : text(cell(row, variantColumn));
    const identity = {
      row: excelRow,
      recipeId: requiredText(
        cell(row, header.get("recipeId") ?? 0),
        excelRow,
        "recipeId",
      ),
      recipeName: requiredText(
        cell(row, header.get("recipeName") ?? 0),
        excelRow,
        "recipeName",
      ),
      productId: requiredText(
        cell(row, header.get("productId") ?? 0),
        excelRow,
        "productId",
      ),
      netQuantity: requiredWhole(
        cell(row, header.get("netQuantity") ?? 0),
        excelRow,
        "netQuantity",
      ),
      yieldPercent: requiredWhole(
        cell(row, header.get("yieldPercent") ?? 0),
        excelRow,
        "yieldPercent",
      ),
      ...(variant === "" ? {} : { variantId: variant }),
    };

    if (kind === WORKBOOK_LINE_KIND.INGREDIENT) {
      lines.push({
        ...identity,
        kind,
        ingredientId: requiredText(
          cell(row, header.get("ingredientId") ?? 0),
          excelRow,
          "ingredientId",
        ),
      });
      continue;
    }

    if (kind === WORKBOOK_LINE_KIND.RECIPE) {
      const stocked = flag(cell(row, header.get("stocked") ?? 0));

      if (stocked === null) {
        throw new ExcelRecipeWorkbookError(
          `Row ${excelRow} has an invalid stocked flag.`,
        );
      }

      lines.push({
        ...identity,
        kind,
        subRecipeId: requiredText(
          cell(row, header.get("subRecipeId") ?? 0),
          excelRow,
          "subRecipeId",
        ),
        stocked,
      });
      continue;
    }

    throw new ExcelRecipeWorkbookError(
      `Row ${excelRow} has an unknown line kind.`,
    );
  }

  return lines;
};

export class ExcelRecipeWorkbook extends RecipeWorkbook {
  override async read(contents: Uint8Array): Promise<RecipeWorkbookSheet> {
    try {
      const book = XLSX.read(contents, { type: "array" });

      return {
        ingredients: ingredientsOf(gridOf(book, INGREDIENT_SHEET)),
        lines: linesOf(gridOf(book, RECIPE_SHEET)),
      };
    } catch (error: unknown) {
      if (error instanceof ExcelRecipeWorkbookError) {
        throw error;
      }

      throw new ExcelRecipeWorkbookError("The workbook could not be read.");
    }
  }
}
