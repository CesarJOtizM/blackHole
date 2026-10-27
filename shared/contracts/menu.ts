import { z } from "zod";

const MENU_COMMAND = {
  PUBLISH_PRODUCT: "publishProduct",
  PUBLISH_COMBO: "publishCombo",
  SET_VENUE_PRICE: "setVenuePrice",
} as const;

const menuVariant = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const menuModifier = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
});

const publishProductCommand = z.object({
  type: z.literal(MENU_COMMAND.PUBLISH_PRODUCT),
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  taxClassification: z.string(),
  variants: z.array(menuVariant).optional(),
  modifiers: z.array(menuModifier).optional(),
});

const publishComboCommand = z.object({
  type: z.literal(MENU_COMMAND.PUBLISH_COMBO),
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  componentIds: z.array(z.string().min(1)),
});

const venueWindow = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

const setVenuePriceCommand = z.object({
  type: z.literal(MENU_COMMAND.SET_VENUE_PRICE),
  venueId: z.string().min(1),
  itemId: z.string().min(1),
  price: z.number(),
  available: z.boolean(),
  window: venueWindow.optional(),
});

export const menuCommand = z.object({
  brandId: z.string().min(1),
  command: z.discriminatedUnion("type", [
    publishProductCommand,
    publishComboCommand,
    setVenuePriceCommand,
  ]),
});

export type MenuCommand = z.infer<typeof menuCommand>;

export const menuUpdated = z.object({
  menuId: z.string(),
  brandId: z.string(),
});

export type MenuUpdated = z.infer<typeof menuUpdated>;

const venueMenuProduct = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  taxClassification: z.string(),
  variants: z.array(menuVariant),
  modifiers: z.array(menuModifier),
  orderable: z.boolean(),
});

const venueMenuCombo = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  componentIds: z.array(z.string()),
  orderable: z.boolean(),
});

export const venueMenu = z.object({
  products: z.array(venueMenuProduct),
  combos: z.array(venueMenuCombo),
});

export type VenueMenu = z.infer<typeof venueMenu>;
