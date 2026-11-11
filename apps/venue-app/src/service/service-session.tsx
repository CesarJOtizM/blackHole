import { createContext, type ReactNode, use, useMemo, useState } from "react";

export type TableState = "free" | "occupied" | "check" | "clean";

export interface OrderLine {
  id: string;
  name: string;
  priceCop: number;
  sent: boolean;
}

export interface DiningTable {
  id: string;
  label: string;
  seats: number;
  state: TableState;
  lines: OrderLine[];
}

export interface KitchenTicket {
  id: string;
  tableLabel: string;
  course: string;
  minutes: number;
  lines: string[];
  ready: boolean;
}

interface ServiceSession {
  clockedIn: boolean;
  tables: DiningTable[];
  tickets: KitchenTicket[];
  shiftOpen: boolean;
  notice: string;
  clockIn: () => void;
  clockOut: () => void;
  openTable: (tableId: string) => void;
  addLine: (tableId: string) => void;
  sendCourse: (tableId: string) => void;
  requestCheck: (tableId: string) => void;
  voidLine: (tableId: string, lineId: string) => void;
  markClean: (tableId: string) => void;
  markTicketReady: (ticketId: string) => void;
  openShift: () => void;
  settleTips: () => void;
}

const ServiceContext = createContext<ServiceSession | null>(null);

const offers = [
  { name: "Churrasco 400 g", priceCop: 44000 },
  { name: "Limonada de coco", priceCop: 12000 },
  { name: "Empanada de carne", priceCop: 8000 },
] as const;

const initialTables: DiningTable[] = [
  {
    id: "01",
    label: "01",
    seats: 4,
    state: "occupied",
    lines: [
      { id: "01-a", name: "Churrasco 400 g", priceCop: 44000, sent: true },
      { id: "01-b", name: "Limonada de coco", priceCop: 12000, sent: true },
    ],
  },
  { id: "02", label: "02", seats: 2, state: "free", lines: [] },
  {
    id: "03",
    label: "03",
    seats: 4,
    state: "check",
    lines: [
      { id: "03-a", name: "Bife de chorizo", priceCop: 52000, sent: true },
      { id: "03-b", name: "Entraña", priceCop: 46000, sent: true },
    ],
  },
  { id: "04", label: "04", seats: 2, state: "clean", lines: [] },
  {
    id: "05",
    label: "05",
    seats: 6,
    state: "occupied",
    lines: [
      { id: "05-a", name: "Costilla BBQ", priceCop: 42000, sent: true },
      { id: "05-b", name: "Empanada de carne", priceCop: 8000, sent: false },
    ],
  },
  { id: "06", label: "06", seats: 4, state: "free", lines: [] },
];

const initialTickets: KitchenTicket[] = [
  {
    id: "k-01",
    tableLabel: "01",
    course: "Fuego 1",
    minutes: 14,
    lines: ["Churrasco 400 g · medio", "Limonada de coco"],
    ready: false,
  },
  {
    id: "k-05",
    tableLabel: "05",
    course: "Fuego 1",
    minutes: 6,
    lines: ["Costilla BBQ"],
    ready: false,
  },
];

function nextOffer(lines: OrderLine[]) {
  return offers[lines.length % offers.length] ?? offers[0];
}

export function tableTotal(table: DiningTable): number {
  return table.lines.reduce((sum, line) => sum + line.priceCop, 0);
}

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [clockedIn, setClockedIn] = useState(true);
  const [tables, setTables] = useState(initialTables);
  const [tickets, setTickets] = useState(initialTickets);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [sequence, setSequence] = useState(1);

  const value = useMemo<ServiceSession>(() => {
    return {
      clockedIn,
      tables,
      tickets,
      shiftOpen,
      notice,
      clockIn: () => {
        setClockedIn(true);
        setNotice("Entrada marcada. Jorge Díaz puede operar Chapinero.");
      },
      clockOut: () => {
        setClockedIn(false);
        setNotice("Salida marcada. Sin entrada no se opera.");
      },
      openTable: (tableId) => {
        setTables((current) =>
          current.map((table) =>
            table.id === tableId && table.state === "free"
              ? { ...table, state: "occupied" }
              : table,
          ),
        );
        setNotice("Cuenta abierta en el salón.");
      },
      addLine: (tableId) => {
        setTables((current) =>
          current.map((table) => {
            if (table.id !== tableId || table.state === "clean") return table;
            const offer = nextOffer(table.lines);
            const line: OrderLine = {
              id: `${tableId}-${sequence}`,
              name: offer.name,
              priceCop: offer.priceCop,
              sent: false,
            };
            return {
              ...table,
              state: table.state === "free" ? "occupied" : table.state,
              lines: [...table.lines, line],
            };
          }),
        );
        setSequence((current) => current + 1);
        setNotice("Producto en la cuenta. Todavía no está en cocina.");
      },
      sendCourse: (tableId) => {
        if (!clockedIn) {
          setNotice("Sin entrada no se envía a cocina.");
          return;
        }
        const table = tables.find((item) => item.id === tableId);
        const pending = table?.lines.filter((line) => !line.sent) ?? [];
        if (pending.length === 0) {
          setNotice("No hay productos nuevos para este fuego.");
          return;
        }
        setTables((current) =>
          current.map((item) =>
            item.id === tableId
              ? {
                  ...item,
                  state: "occupied",
                  lines: item.lines.map((line) => ({ ...line, sent: true })),
                }
              : item,
          ),
        );
        setTickets((current) => [
          {
            id: `k-${tableId}-${sequence}`,
            tableLabel: table?.label ?? tableId,
            course: "Fuego nuevo",
            minutes: 0,
            lines: pending.map((line) => line.name),
            ready: false,
          },
          ...current,
        ]);
        setSequence((current) => current + 1);
        setNotice(
          "Fuego enviado a la estación. La comanda sale por la impresora.",
        );
      },
      requestCheck: (tableId) => {
        setTables((current) =>
          current.map((table) =>
            table.id === tableId ? { ...table, state: "check" } : table,
          ),
        );
        setNotice("Precuenta impresa en 80 mm, con el QR de facturación.");
      },
      voidLine: (tableId, lineId) => {
        setTables((current) =>
          current.map((table) =>
            table.id === tableId
              ? {
                  ...table,
                  lines: table.lines.filter((line) => line.id !== lineId),
                }
              : table,
          ),
        );
        setNotice("Línea anulada con PIN del supervisor. Queda en auditoría.");
      },
      markClean: (tableId) => {
        setTables((current) =>
          current.map((table) =>
            table.id === tableId
              ? { ...table, state: "free", lines: [] }
              : table,
          ),
        );
        setNotice("Mesa libre.");
      },
      markTicketReady: (ticketId) => {
        setTickets((current) =>
          current.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, ready: true } : ticket,
          ),
        );
        setNotice("Estación marcó listo. El mesero puede entregar.");
      },
      openShift: () => {
        setShiftOpen(true);
        setNotice("Turno abierto con base de $200.000.");
      },
      settleTips: () => {
        setNotice(
          "Propinas del sábado: $186.000 entre 6 personas. $31.000 cada una. Liquidación impresa.",
        );
      },
    };
  }, [clockedIn, notice, sequence, shiftOpen, tables, tickets]);

  return <ServiceContext value={value}>{children}</ServiceContext>;
}

export function useService(): ServiceSession {
  const value = use(ServiceContext);
  if (value === null) {
    throw new Error("ServiceProvider is missing");
  }
  return value;
}
