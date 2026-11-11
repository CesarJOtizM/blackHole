export interface NavItem {
  to: string;
  label: string;
  match: (pathname: string) => boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const exact = (path: string) => (pathname: string) => pathname === path;

const nested = (path: string) => (pathname: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export const navigation: NavSection[] = [
  {
    label: "Operación",
    items: [
      { to: "/home", label: "Inicio", match: exact("/home") },
      { to: "/reports/sales", label: "Reportes", match: nested("/reports") },
      { to: "/audit", label: "Auditoría", match: exact("/audit") },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        to: "/catalog/menu",
        label: "Carta",
        match: (pathname) => pathname.startsWith("/catalog"),
      },
      { to: "/inventory", label: "Inventario", match: nested("/inventory") },
      { to: "/deliveries", label: "Domicilios", match: nested("/deliveries") },
      {
        to: "/reservations",
        label: "Reservas",
        match: nested("/reservations"),
      },
    ],
  },
  {
    label: "Empresa",
    items: [
      { to: "/structure", label: "Estructura", match: nested("/structure") },
      { to: "/fiscal", label: "Fiscal", match: nested("/fiscal") },
      { to: "/people", label: "Personas", match: nested("/people") },
      { to: "/attendance", label: "Asistencia", match: nested("/attendance") },
      { to: "/plan", label: "Plan", match: nested("/plan") },
    ],
  },
];

export const catalogLinks = [
  { to: "/catalog/menu", label: "Carta", key: "menu" },
  { to: "/catalog/tables", label: "Mesas", key: "tables" },
  { to: "/catalog/qr-orders", label: "Pedidos por QR", key: "qr" },
] as const;

export type CatalogLinkKey = (typeof catalogLinks)[number]["key"];
