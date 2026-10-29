export const layer = "domain" as const;

export type { LineState, OrderChannel } from "#domain/check.js";
export {
  Check,
  ComboNotSent,
  EmptyOrder,
  InvalidCheckId,
  InvalidCheckPrice,
  InvalidLineId,
  InvalidOrderChannel,
  InvalidOrderId,
  LineTransitionRejected,
  TableNotOpen,
} from "#domain/check.js";
export type { TableState } from "#domain/dining-table.js";
export {
  DiningTable,
  InvalidTableId,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";
export { KitchenTicket } from "#domain/kitchen-ticket.js";
export type { VenuePrice } from "#domain/menu.js";
export {
  DuplicateMenuId,
  ForeignModifier,
  InvalidMenuId,
  InvalidMenuPrice,
  Menu,
  MissingTaxClassification,
  UnknownMenuReference,
} from "#domain/menu.js";
export type { RoutedProduct, StationOutput } from "#domain/station-router.js";
export {
  DuplicateStationProduct,
  InvalidStationId,
  InvalidStationOutput,
  MissingStation,
  StationRouter,
} from "#domain/station-router.js";
