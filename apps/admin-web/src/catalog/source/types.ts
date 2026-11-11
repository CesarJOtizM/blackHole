export type BrandId = "la-parrilla" | "burger-street";

export type CategoryId =
  | "starters"
  | "cuts"
  | "mixed"
  | "sides"
  | "desserts"
  | "drinks";

export type ProductStatus = "on-menu" | "paused-today" | "venue-only";

export type VenueAvailability =
  | "yes"
  | "here-only"
  | "sold-out-today"
  | "hidden"
  | "scheduled";

export type VenueOfferAction = "remove" | "reactivate" | "edit";

export type TableShape = "round" | "wide";

export type QrMode = "view-only" | "accept" | "direct";

export interface Brand {
  id: BrandId;
  label: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  productCount: number;
}

export interface SaleChannels {
  diningRoom: boolean;
  tableQr: boolean;
  ownDelivery: boolean;
  rappi: boolean;
}

export interface ProductVariant {
  name: string;
  price: number;
  recipeCode: string;
  active: boolean;
}

export interface ProductModifier {
  group: string;
  rule: string;
  options: string;
}

export interface MenuProduct {
  id: string;
  brandId: BrandId;
  categoryId: CategoryId;
  name: string;
  price: number;
  tax: string;
  station: string;
  modifierCount: number;
  status: ProductStatus;
  venueName?: string;
}

export interface ProductDetail extends MenuProduct {
  ticketName: string;
  targetMinutes: number;
  variants: ProductVariant[];
  modifiers: ProductModifier[];
  channels: SaleChannels;
  recipeCost: number;
}

export interface ProductDraft {
  menuName: string;
  ticketName: string;
  price: number;
  tax: string;
  station: string;
  targetMinutes: number;
  channels: SaleChannels;
}

export interface ModifierGroup {
  id: string;
  brandId: BrandId;
  group: string;
  rule: string;
  options: string;
}

export interface Venue {
  id: string;
  label: string;
}

export interface VenueOffer {
  productId: string;
  productName: string;
  brandPrice: number;
  venuePrice: number;
  availability: VenueAvailability;
  availabilityLabel: string;
  reason: string;
  action: VenueOfferAction;
}

export interface DiningZone {
  id: string;
  venueId: string;
  name: string;
}

export interface DiningTable {
  id: string;
  venueId: string;
  zoneId: string;
  label: string;
  seats: number;
  shape: TableShape;
  qrCode: string;
  qrVersion: number;
}

export interface QrCapability {
  id: string;
  title: string;
  detail: string;
  enabled: boolean;
}

export interface QrSettings {
  venueId: string;
  mode: QrMode;
  unassignedTable: string;
  maxUnacceptedAmount: number;
  hours: string;
  capabilities: QrCapability[];
}

export interface AdminSource {
  listBrands: () => Promise<Brand[]>;
  listCategories: (brandId: BrandId) => Promise<Category[]>;
  countProducts: (brandId: BrandId) => Promise<number>;
  listProducts: (
    brandId: BrandId,
    categoryId: CategoryId,
  ) => Promise<MenuProduct[]>;
  listModifierGroups: (brandId: BrandId) => Promise<ModifierGroup[]>;
  getProduct: (productId: string) => Promise<ProductDetail | null>;
  saveProduct: (
    productId: string,
    draft: ProductDraft,
  ) => Promise<ProductDetail>;
  duplicateProduct: (productId: string) => Promise<ProductDetail>;
  createProduct: (
    brandId: BrandId,
    categoryId: CategoryId,
  ) => Promise<ProductDetail>;
  importSampleProduct: (
    brandId: BrandId,
    categoryId: CategoryId,
  ) => Promise<ProductDetail>;
  listVenues: () => Promise<Venue[]>;
  listVenueOffers: (venueId: string) => Promise<VenueOffer[]>;
  removeVenueOffer: (venueId: string, productId: string) => Promise<void>;
  reactivateVenueOffer: (venueId: string, productId: string) => Promise<void>;
  listZones: (venueId: string) => Promise<DiningZone[]>;
  listTables: (venueId: string, zoneId: string) => Promise<DiningTable[]>;
  addTable: (venueId: string, zoneId: string) => Promise<DiningTable>;
  regenerateQr: (tableId: string) => Promise<DiningTable>;
  getQrSettings: (venueId: string) => Promise<QrSettings>;
  saveQrSettings: (settings: QrSettings) => Promise<QrSettings>;
}
