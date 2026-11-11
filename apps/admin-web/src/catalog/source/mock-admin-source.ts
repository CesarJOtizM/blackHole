import type {
  AdminSource,
  Brand,
  CategoryId,
  DiningTable,
  DiningZone,
  MenuProduct,
  ModifierGroup,
  ProductDetail,
  ProductDraft,
  QrSettings,
  Venue,
  VenueAvailability,
  VenueOffer,
} from "#src/catalog/source/types.js";

const brands: Brand[] = [
  { id: "la-parrilla", label: "La Parrilla" },
  { id: "burger-street", label: "Burger Street" },
];

const categoryNames: Record<CategoryId, string> = {
  starters: "Entradas",
  cuts: "Cortes",
  mixed: "Parrilla mixta",
  sides: "Acompañantes",
  desserts: "Postres",
  drinks: "Bebidas",
};

const venues: Venue[] = [
  { id: "usaquen", label: "Usaquén" },
  { id: "chapinero", label: "Chapinero" },
];

const channels = {
  diningRoom: true,
  tableQr: true,
  ownDelivery: false,
  rappi: false,
};

function product(
  fields: Omit<
    ProductDetail,
    | "variants"
    | "modifiers"
    | "channels"
    | "recipeCost"
    | "ticketName"
    | "targetMinutes"
  > &
    Partial<
      Pick<
        ProductDetail,
        | "variants"
        | "modifiers"
        | "channels"
        | "recipeCost"
        | "ticketName"
        | "targetMinutes"
      >
    >,
): ProductDetail {
  return {
    ticketName: fields.name.split(" ")[0]?.toUpperCase() ?? fields.name,
    targetMinutes: 18,
    variants: [
      {
        name: "Única",
        price: fields.price,
        recipeCode: fields.id.toUpperCase(),
        active: true,
      },
    ],
    modifiers: [],
    channels,
    recipeCost: Math.round(fields.price * 0.36),
    ...fields,
  };
}

function seedProducts(): ProductDetail[] {
  return [
    product({
      id: "churrasco",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Churrasco 400 g",
      ticketName: "CHURRASCO",
      price: 44000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 3,
      status: "on-menu",
      targetMinutes: 18,
      recipeCost: 15840,
      variants: [
        {
          name: "400 g",
          price: 44000,
          recipeCode: "CHURRASCO-400",
          active: true,
        },
        {
          name: "600 g",
          price: 61000,
          recipeCode: "CHURRASCO-600",
          active: true,
        },
      ],
      modifiers: [
        {
          group: "Término",
          rule: "Obligatorio · 1",
          options: "Azul, medio, tres cuartos, bien asado",
        },
        {
          group: "Acompañante",
          rule: "Obligatorio · 1",
          options: "Papa criolla, ensalada, yuca",
        },
        {
          group: "Adiciones",
          rule: "Opcional · hasta 3",
          options: "Chimichurri +$3.000, huevo +$2.500",
        },
      ],
    }),
    product({
      id: "bife",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Bife de chorizo",
      price: 52000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 3,
      status: "paused-today",
    }),
    product({
      id: "punta",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Punta de anca",
      price: 48000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 3,
      status: "on-menu",
    }),
    product({
      id: "entrana",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Entraña",
      price: 46000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 2,
      status: "on-menu",
    }),
    product({
      id: "tomahawk",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Tomahawk 1 kg",
      price: 139000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 4,
      status: "venue-only",
      venueName: "Usaquén",
    }),
    product({
      id: "costilla",
      brandId: "la-parrilla",
      categoryId: "cuts",
      name: "Costilla BBQ",
      price: 42000,
      tax: "INC 8%",
      station: "Parrilla",
      modifierCount: 2,
      status: "on-menu",
    }),
    product({
      id: "empanada",
      brandId: "la-parrilla",
      categoryId: "starters",
      name: "Empanada de carne",
      price: 8000,
      tax: "INC 8%",
      station: "Fritura",
      modifierCount: 0,
      status: "on-menu",
    }),
    product({
      id: "limonada",
      brandId: "la-parrilla",
      categoryId: "drinks",
      name: "Limonada de coco",
      price: 12000,
      tax: "INC 8%",
      station: "Barra",
      modifierCount: 0,
      status: "on-menu",
    }),
    product({
      id: "ejecutivo",
      brandId: "la-parrilla",
      categoryId: "mixed",
      name: "Menú ejecutivo",
      price: 28000,
      tax: "INC 8%",
      station: "Cocina",
      modifierCount: 1,
      status: "on-menu",
    }),
    product({
      id: "clasica",
      brandId: "burger-street",
      categoryId: "cuts",
      name: "Clásica",
      price: 26000,
      tax: "IVA 19%",
      station: "Plancha",
      modifierCount: 2,
      status: "on-menu",
    }),
    product({
      id: "doble",
      brandId: "burger-street",
      categoryId: "cuts",
      name: "Doble queso",
      price: 32000,
      tax: "IVA 19%",
      station: "Plancha",
      modifierCount: 2,
      status: "on-menu",
    }),
  ];
}

function seedOffers(): Record<string, VenueOffer[]> {
  return {
    usaquen: [
      {
        productId: "tomahawk",
        productName: "Tomahawk 1 kg",
        brandPrice: 139000,
        venuePrice: 139000,
        availability: "here-only",
        availabilityLabel: "Solo aquí",
        reason: "Equipo de parrilla grande",
        action: "remove",
      },
      {
        productId: "churrasco",
        productName: "Churrasco 400 g",
        brandPrice: 44000,
        venuePrice: 47000,
        availability: "yes",
        availabilityLabel: "Sí",
        reason: "Arriendo zona norte",
        action: "remove",
      },
      {
        productId: "entrana",
        productName: "Entraña",
        brandPrice: 46000,
        venuePrice: 46000,
        availability: "sold-out-today",
        availabilityLabel: "Agotado hoy",
        reason: "Marcado desde cocina 13:40",
        action: "reactivate",
      },
      {
        productId: "limonada",
        productName: "Limonada de coco",
        brandPrice: 12000,
        venuePrice: 12000,
        availability: "hidden",
        availabilityLabel: "Oculto",
        reason: "Sin licuadora industrial",
        action: "remove",
      },
      {
        productId: "ejecutivo",
        productName: "Menú ejecutivo",
        brandPrice: 28000,
        venuePrice: 28000,
        availability: "scheduled",
        availabilityLabel: "L–V 12–15",
        reason: "Franja horaria",
        action: "edit",
      },
    ],
    chapinero: [
      {
        productId: "churrasco",
        productName: "Churrasco 400 g",
        brandPrice: 44000,
        venuePrice: 44000,
        availability: "yes",
        availabilityLabel: "Sí",
        reason: "Precio de marca",
        action: "remove",
      },
      {
        productId: "bife",
        productName: "Bife de chorizo",
        brandPrice: 52000,
        venuePrice: 52000,
        availability: "sold-out-today",
        availabilityLabel: "Agotado hoy",
        reason: "Pausado en la carta de la marca",
        action: "reactivate",
      },
    ],
  };
}

function qrSettings(venueId: string): QrSettings {
  return {
    venueId,
    mode: "direct",
    unassignedTable: "No acepta pedidos",
    maxUnacceptedAmount: 300000,
    hours: "12:00 – 22:30",
    capabilities: [
      {
        id: "account",
        title: "Ver su cuenta en vivo",
        detail: "Incluye lo que pidió el mesero",
        enabled: true,
      },
      {
        id: "split",
        title: "Dividir y pagar desde el celular",
        detail: "Pasarela con datáfono virtual",
        enabled: true,
      },
      {
        id: "tip",
        title: "Dejar propina voluntaria",
        detail: "Nunca se agrega sin que la elija",
        enabled: true,
      },
      {
        id: "invoice",
        title: "Pedir factura electrónica con sus datos",
        detail: "Pide autorización de datos",
        enabled: false,
      },
    ],
  };
}

function chapineroTables(): DiningTable[] {
  const seats = [4, 4, 4, 2, 2, 6, 4, 4, 4, 2, 2, 8, 4];
  return seats.map((seatCount, index) => {
    const number = index + 1;
    const label = String(number).padStart(2, "0");
    return {
      id: `chapinero-${label}`,
      venueId: "chapinero",
      zoneId: "salon",
      label,
      seats: seatCount,
      shape: seatCount >= 6 ? "wide" : "round",
      qrCode: `blackhole.co/m/7KD2-${label}`,
      qrVersion: 3,
    };
  });
}

interface CatalogState {
  products: ProductDetail[];
  groups: ModifierGroup[];
  offers: Record<string, VenueOffer[]>;
  zones: DiningZone[];
  tables: DiningTable[];
  qr: Record<string, QrSettings>;
  sequence: number;
}

function createState(): CatalogState {
  return {
    products: seedProducts(),
    groups: [
      {
        id: "term",
        brandId: "la-parrilla",
        group: "Término",
        rule: "Obligatorio · 1",
        options: "Azul, medio, tres cuartos, bien asado",
      },
      {
        id: "side",
        brandId: "la-parrilla",
        group: "Acompañante",
        rule: "Obligatorio · 1",
        options: "Papa criolla, ensalada, yuca",
      },
      {
        id: "extra",
        brandId: "la-parrilla",
        group: "Adiciones",
        rule: "Opcional · hasta 3",
        options: "Chimichurri +$3.000, huevo +$2.500",
      },
    ],
    offers: seedOffers(),
    zones: [
      { id: "salon", venueId: "chapinero", name: "Salón principal" },
      { id: "terrace", venueId: "chapinero", name: "Terraza" },
      { id: "bar", venueId: "chapinero", name: "Barra" },
      { id: "salon", venueId: "usaquen", name: "Salón principal" },
      { id: "terrace", venueId: "usaquen", name: "Terraza" },
    ],
    tables: [
      ...chapineroTables(),
      {
        id: "chapinero-terrace-01",
        venueId: "chapinero",
        zoneId: "terrace",
        label: "T1",
        seats: 2,
        shape: "round",
        qrCode: "blackhole.co/m/7KD2-T1",
        qrVersion: 1,
      },
      {
        id: "usaquen-01",
        venueId: "usaquen",
        zoneId: "salon",
        label: "01",
        seats: 4,
        shape: "round",
        qrCode: "blackhole.co/m/9AQ1-01",
        qrVersion: 1,
      },
    ],
    qr: {
      chapinero: qrSettings("chapinero"),
      usaquen: qrSettings("usaquen"),
    },
    sequence: 1,
  };
}

function toMenuProduct(item: ProductDetail): MenuProduct {
  return {
    id: item.id,
    brandId: item.brandId,
    categoryId: item.categoryId,
    name: item.name,
    price: item.price,
    tax: item.tax,
    station: item.station,
    modifierCount: item.modifierCount,
    status: item.status,
    venueName: item.venueName,
  };
}

function availabilityLabel(availability: VenueAvailability): string {
  if (availability === "yes") return "Sí";
  if (availability === "here-only") return "Solo aquí";
  if (availability === "sold-out-today") return "Agotado hoy";
  if (availability === "hidden") return "Oculto";
  return "Con horario";
}

export function createMockAdminSource(): AdminSource {
  const state = createState();

  const ready = async <T>(value: T): Promise<T> => value;

  return {
    listBrands: () => ready(brands),
    listVenues: () => ready(venues),
    listCategories: (brandId) => {
      const categories = (Object.keys(categoryNames) as CategoryId[]).map(
        (id) => ({
          id,
          name: categoryNames[id],
          productCount: state.products.filter(
            (item) => item.brandId === brandId && item.categoryId === id,
          ).length,
        }),
      );
      return ready(categories);
    },
    countProducts: (brandId) =>
      ready(state.products.filter((item) => item.brandId === brandId).length),
    listProducts: (brandId, categoryId) =>
      ready(
        state.products
          .filter(
            (item) =>
              item.brandId === brandId && item.categoryId === categoryId,
          )
          .map(toMenuProduct),
      ),
    listModifierGroups: (brandId) =>
      ready(state.groups.filter((group) => group.brandId === brandId)),
    getProduct: (productId) =>
      ready(state.products.find((item) => item.id === productId) ?? null),
    saveProduct: (productId, draft: ProductDraft) => {
      const current = state.products.find((item) => item.id === productId);
      if (current === undefined) {
        return Promise.reject(new Error("Product not found"));
      }
      current.name = draft.menuName;
      current.ticketName = draft.ticketName;
      current.price = draft.price;
      current.tax = draft.tax;
      current.station = draft.station;
      current.targetMinutes = draft.targetMinutes;
      current.channels = draft.channels;
      current.modifierCount = current.modifiers.length;
      return ready(current);
    },
    duplicateProduct: (productId) => {
      const current = state.products.find((item) => item.id === productId);
      if (current === undefined) {
        return Promise.reject(new Error("Product not found"));
      }
      const copy: ProductDetail = {
        ...current,
        id: `${current.id}-copia-${state.sequence}`,
        name: `${current.name} copia`,
        channels: { ...current.channels },
        variants: current.variants.map((variant) => ({ ...variant })),
        modifiers: current.modifiers.map((modifier) => ({ ...modifier })),
      };
      state.sequence += 1;
      state.products.push(copy);
      return ready(copy);
    },
    createProduct: (brandId, categoryId) => {
      const created = product({
        id: `nuevo-${state.sequence}`,
        brandId,
        categoryId,
        name: "Nuevo producto",
        price: 0,
        tax: "INC 8%",
        station: "Parrilla",
        modifierCount: 0,
        status: "on-menu",
      });
      state.sequence += 1;
      state.products.push(created);
      return ready(created);
    },
    importSampleProduct: (brandId, categoryId) => {
      const imported = product({
        id: `importado-${state.sequence}`,
        brandId,
        categoryId,
        name: "Costilla ahumada",
        price: 45000,
        tax: "INC 8%",
        station: "Parrilla",
        modifierCount: 1,
        status: "on-menu",
      });
      state.sequence += 1;
      state.products.push(imported);
      return ready(imported);
    },
    listVenueOffers: (venueId) => ready(state.offers[venueId] ?? []),
    removeVenueOffer: (venueId, productId) => {
      state.offers[venueId] = (state.offers[venueId] ?? []).filter(
        (offer) => offer.productId !== productId,
      );
      return ready(undefined);
    },
    reactivateVenueOffer: (venueId, productId) => {
      const offer = (state.offers[venueId] ?? []).find(
        (item) => item.productId === productId,
      );
      if (offer !== undefined) {
        offer.availability = "yes";
        offer.availabilityLabel = availabilityLabel("yes");
        offer.action = "remove";
        offer.reason = "Reactivado en la sede";
      }
      return ready(undefined);
    },
    listZones: (venueId) =>
      ready(state.zones.filter((zone) => zone.venueId === venueId)),
    listTables: (venueId, zoneId) =>
      ready(
        state.tables.filter(
          (table) => table.venueId === venueId && table.zoneId === zoneId,
        ),
      ),
    addTable: (venueId, zoneId) => {
      const count =
        state.tables.filter(
          (table) => table.venueId === venueId && table.zoneId === zoneId,
        ).length + 1;
      const label = String(count).padStart(2, "0");
      const table: DiningTable = {
        id: `${venueId}-${zoneId}-${label}-${state.sequence}`,
        venueId,
        zoneId,
        label,
        seats: 4,
        shape: "round",
        qrCode: `blackhole.co/m/${venueId}-${label}`,
        qrVersion: 1,
      };
      state.sequence += 1;
      state.tables.push(table);
      return ready(table);
    },
    regenerateQr: (tableId) => {
      const table = state.tables.find((item) => item.id === tableId);
      if (table === undefined) {
        return Promise.reject(new Error("Table not found"));
      }
      table.qrVersion += 1;
      table.qrCode = `blackhole.co/m/${table.venueId}-${table.label}-v${table.qrVersion}`;
      return ready(table);
    },
    getQrSettings: (venueId) => {
      const settings = state.qr[venueId] ?? qrSettings(venueId);
      state.qr[venueId] = settings;
      return ready(settings);
    },
    saveQrSettings: (settings) => {
      state.qr[settings.venueId] = {
        ...settings,
        capabilities: settings.capabilities.map((capability) => ({
          ...capability,
        })),
      };
      return ready(state.qr[settings.venueId]);
    },
  };
}
