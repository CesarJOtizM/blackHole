export const layer = "domain" as const;

export type { SalesParts, Weekday } from "#domain/metrics.js";
export {
  average,
  bogotaHour,
  bogotaWeekday,
  durationMs,
  nearestRank,
  netSalesCop,
  WEEKDAY,
} from "#domain/metrics.js";
