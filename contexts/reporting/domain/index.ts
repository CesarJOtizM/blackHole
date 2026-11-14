export const layer = "domain" as const;

export type {
  FoodCostConsumption,
  FoodCostLineKind,
  FoodCostQuery,
  FoodCostRatio,
  FoodCostSale,
  RecipeVersionLine,
  SalesParts,
  StockCountFact,
  StockGapQuery,
  StockGapResult,
  StockGapRow,
  StockMovementFact,
  StockMovementKind,
  Weekday,
} from "#domain/metrics.js";
export {
  average,
  bogotaHour,
  bogotaWeekday,
  durationMs,
  foodCostRatio,
  nearestRank,
  netSalesCop,
  stockGap,
  WEEKDAY,
} from "#domain/metrics.js";
