export type StructureSection = "taxpayers" | "brands" | "venues" | "warehouses";

export const taxpayers = [
  [
    "La Parrilla SAS",
    "901.112.334-5",
    "Responsable de IVA",
    "INC 8%",
    "3",
    "Habilitado",
  ],
  [
    "Parrilla Norte SAS",
    "901.556.778-1",
    "Responsable de IVA",
    "INC 8%",
    "1",
    "NIT en revisión",
  ],
] as const;

export const brands = [
  {
    name: "La Parrilla",
    detail: "Asados y cocina colombiana",
    venues: "Chapinero · Usaquén · Cedritos",
  },
  {
    name: "Burger Ember",
    detail: "Marca virtual de hamburguesas",
    venues: "Salitre · solo domicilios",
  },
] as const;

export const warehouses = [
  ["Bodega general", "Nube", "Todas las sedes"],
  ["Chapinero", "Sede", "La Parrilla SAS"],
  ["Usaquén", "Sede", "La Parrilla SAS"],
  ["Cedritos", "Sede", "La Parrilla SAS"],
  ["Salitre", "Sede", "Burger Ember"],
] as const;

export const stations = [
  ["Parrilla", "Fuertes, asados, hamburguesas", "Tablet 01", "—"],
  ["Fríos", "Entradas frías, ensaladas, postres", "Tablet 02", "—"],
  ["Barra", "Bebidas, cócteles", "—", "Térmica 02"],
] as const;

export const registers = [
  ["Caja 1", "FECH · 18001–25000", "Redeban 44", "Térmica 01"],
  ["Caja 2 · terraza", "FECH · compartida", "—", "Térmica 03"],
] as const;

export const devices = [
  ["Celular Luis", "Celular", "Mesero", "14:20", "Activo"],
  ["Tablet caja 1", "Tablet", "Caja", "14:20", "Activo"],
  ["Tablet parrilla", "Tablet", "Cocina fija", "14:19", "Activo"],
  ["Celular Pedro", "Celular", "Bodega", "Ayer", "Activo"],
  ["Celular viejo caja", "Celular", "Caja", "12 oct", "Revocado"],
] as const;

export const outages = [
  ["05 nov", "39 min", "29", "6", "1 rechazada"],
  ["28 oct", "12 min", "8", "2", "Sin pérdidas"],
  ["19 oct", "2 h 05", "141", "38", "Sin pérdidas"],
] as const;

export const returnQueue = [
  ["Factura 1842", "DIAN", "Sin respuesta de Factus", "Pendiente"],
  ["Pago QR mesa 6", "Pasarela", "Confirmado, sin aplicar", "Pendiente"],
  ["Pedido QR mesa 3", "Pedido", "Se envía con el siguiente lote", "En cola"],
  ["Auditoría 13:44", "Evento", "Se envía con el siguiente lote", "En cola"],
] as const;

export const hybridNodes = [
  ["Chapinero · nodo principal", "En línea", "hace 4 s", "4 eventos"],
  ["Bodega central · modo bodega", "En línea", "hace 9 s", "0"],
  ["Sede Andrés Carne · nodo", "Sin señal", "hace 26 min", "11 eventos"],
] as const;
