import type { NavIconName } from "#src/shell/nav-icon.js";

export interface NavItem {
  to: string;
  label: string;
  icon?: NavIconName;
  match: (pathname: string) => boolean;
  children?: NavItem[];
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
      { to: "/home", label: "Inicio", icon: "house", match: exact("/home") },
      {
        to: "/reports/sales",
        label: "Reportes",
        icon: "chart",
        match: nested("/reports"),
      },
      {
        to: "/audit",
        label: "Auditoría",
        icon: "scroll",
        match: exact("/audit"),
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        to: "/catalog/menu",
        label: "Carta",
        icon: "book",
        match: (pathname) => pathname.startsWith("/catalog"),
      },
      {
        to: "/inventory",
        label: "Inventario",
        icon: "package",
        match: (pathname) =>
          pathname.startsWith("/inventory") ||
          pathname === "/ingredients" ||
          pathname === "/recipes" ||
          pathname === "/import",
        children: [
          {
            to: "/inventory/scarcity",
            label: "Escasez",
            match: nested("/inventory/scarcity"),
          },
          {
            to: "/ingredients",
            label: "Ingredientes",
            match: exact("/ingredients"),
          },
          { to: "/recipes", label: "Recetas", match: exact("/recipes") },
          { to: "/import", label: "Importar", match: exact("/import") },
        ],
      },
      {
        to: "/deliveries",
        label: "Domicilios",
        icon: "bike",
        match: nested("/deliveries"),
        children: [
          {
            to: "/deliveries/mapping",
            label: "Mapeo",
            match: exact("/deliveries/mapping"),
          },
          {
            to: "/deliveries/reconciliation",
            label: "Conciliación",
            match: exact("/deliveries/reconciliation"),
          },
        ],
      },
      {
        to: "/reservations",
        label: "Reservas",
        icon: "calendar",
        match: nested("/reservations"),
      },
    ],
  },
  {
    label: "Empresa",
    items: [
      {
        to: "/structure",
        label: "Estructura",
        icon: "building",
        match: nested("/structure"),
      },
      {
        to: "/fiscal",
        label: "Fiscal",
        icon: "landmark",
        match: nested("/fiscal"),
        children: [
          {
            to: "/fiscal/documents",
            label: "Rechazados",
            match: exact("/fiscal/documents"),
          },
          {
            to: "/fiscal/balance",
            label: "Saldo",
            match: exact("/fiscal/balance"),
          },
          {
            to: "/fiscal/reinvoice",
            label: "Refacturación",
            match: exact("/fiscal/reinvoice"),
          },
        ],
      },
      {
        to: "/people",
        label: "Personas",
        icon: "users",
        match: nested("/people"),
        children: [
          {
            to: "/people/roles/cajero-senior",
            label: "Rol",
            match: nested("/people/roles"),
          },
        ],
      },
      {
        to: "/attendance",
        label: "Asistencia",
        icon: "clock",
        match: nested("/attendance"),
        children: [
          {
            to: "/attendance/rules",
            label: "Reglas",
            match: exact("/attendance/rules"),
          },
          {
            to: "/attendance/hours",
            label: "Horas",
            match: exact("/attendance/hours"),
          },
        ],
      },
      { to: "/plan", label: "Plan", icon: "card", match: nested("/plan") },
    ],
  },
];

export const catalogLinks = [
  { to: "/catalog/menu", label: "Carta", key: "menu" },
  { to: "/catalog/tables", label: "Mesas", key: "tables" },
  { to: "/catalog/qr-orders", label: "Pedidos por QR", key: "qr" },
] as const;

export type CatalogLinkKey = (typeof catalogLinks)[number]["key"];
