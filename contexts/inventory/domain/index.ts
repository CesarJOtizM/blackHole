export const layer = "domain" as const;

export type {
  OperationalWaste,
  WasteReason,
} from "#domain/operational-waste.js";
export {
  InvalidWaste,
  MissingWasteReason,
  recordOperationalWaste,
  WASTE_REASON,
  WasteNoteRequired,
} from "#domain/operational-waste.js";
export type {
  AvailabilityState,
  PossibleUnits,
} from "#domain/producible-quantity.js";
export { possibleUnits } from "#domain/producible-quantity.js";
export type {
  ProductionCostRule,
  ProductionMovement,
} from "#domain/production.js";
export {
  InvalidProduction,
  PRODUCTION_COST_RULE,
  ProductionAlreadyCompensated,
  ProductionRun,
} from "#domain/production.js";
export type {
  BaseReceipt,
  PurchaseOrderLineView,
  PurchaseOrderStatus,
  ReceivedLine,
  Supplier,
} from "#domain/purchasing.js";
export {
  DuplicateId,
  InvalidPurchase,
  OverReceipt,
  PURCHASE_ORDER_STATUS,
  PurchaseOrder,
  PurchaseOrderClosed,
  Purchasing,
  toBaseReceipt,
} from "#domain/purchasing.js";
export type {
  BaseUnit,
  ExplodedQuantity,
  IngredientView,
  ModifierView,
  PublishedVersion,
  RecipeView,
} from "#domain/recipe-catalog.js";
export {
  BASE_UNIT,
  InvalidQuantity,
  InvalidRecipeCatalogId,
  InvalidReferenceCost,
  InvalidYield,
  MissingOutputQuantity,
  QUANTITY_SCALE,
  RecipeCatalog,
  RecipeCycle,
  UnknownIngredient,
  UnknownModifier,
  UnknownRecipe,
  UnknownRecipeVersion,
  ZeroUnitFactor,
} from "#domain/recipe-catalog.js";
export type {
  CountScope,
  FrozenCountLine,
  StockCountResult,
} from "#domain/stock-count.js";
export {
  COUNT_SCOPE,
  InvalidCount,
  MissingCountLine,
  submitStockCount,
} from "#domain/stock-count.js";
export type { MovementType, StockMovement } from "#domain/stock-ledger.js";
export {
  MOVEMENT_TYPE,
  MovementAlreadyReversed,
  MovementImmutable,
  MovementTypeNotWritable,
  nextAverageCost,
  StockLedger,
  UnknownMovement,
} from "#domain/stock-ledger.js";
export type {
  DestinationAverage,
  ReplenishmentLevels,
  TransferLineView,
  TransferMovement,
  TransferReceipt,
  TransferStatus,
} from "#domain/transfer.js";
export {
  InsufficientOnHand,
  InvalidTransfer,
  suggestReplenishment,
  TRANSFER_STATUS,
  Transfer,
  TransferNotInTransit,
} from "#domain/transfer.js";
