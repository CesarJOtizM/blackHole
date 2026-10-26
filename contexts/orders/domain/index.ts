export const layer = "domain" as const;

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
