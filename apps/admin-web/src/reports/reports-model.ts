import type { Cell, RecordMetric } from "#src/shell/record-page.js";

export const reportSections = [
  "sales",
  "times",
  "food-cost",
  "leakage",
  "staff",
  "accountant",
  "engineering",
  "reservations",
  "control",
] as const;

export type ReportSection = (typeof reportSections)[number];

export interface ReportChartBar {
  label: string;
  height: number;
  tone?: "ink" | "stamp";
}

export interface ReportChart {
  title: string;
  bars: ReportChartBar[];
}

export interface ReportModel {
  eyebrow: string;
  title: string;
  metrics: RecordMetric[];
  columns: string[];
  rows: Cell[][];
  note?: string;
  chart?: ReportChart;
}

const chip = (label: string, tone: "go" | "stamp" | "hold" | "ink"): Cell => ({
  chip: label,
  tone,
});

export const reports: Record<ReportSection, ReportModel> = {
  sales: {
    eyebrow: "Octubre 2026 · todas las sedes",
    title: "Ventas",
    metrics: [
      { label: "Venta neta", value: "$642 M", detail: "+8% vs sep" },
      { label: "Cuentas", value: "9.812", detail: "+5%" },
      { label: "Ticket promedio", value: "$65.400", detail: "+2,8%" },
      { label: "Participación", value: "21%", detail: "de la venta" },
    ],
    columns: ["Sede", "Venta", "Vs sep"],
    rows: [
      ["Chapinero", "$248 M", "+11%"],
      ["Usaquén", "$186 M", "+9%"],
      ["Cedritos", "$121 M", "+4%"],
      ["Salitre", "$87 M", "-3%"],
    ],
    note: "Venta por día: lun a dom, con el pico del sábado.",
    chart: {
      title: "Venta por día de la semana",
      bars: [
        { label: "Lun", height: 108 },
        { label: "Mar", height: 127 },
        { label: "Mié", height: 137 },
        { label: "Jue", height: 166 },
        { label: "Vie", height: 245, tone: "stamp" },
        { label: "Sáb", height: 272, tone: "stamp" },
        { label: "Dom", height: 195 },
      ],
    },
  },
  times: {
    eyebrow: "Desde que se envía a cocina hasta que se entrega",
    title: "Tiempos de servicio",
    metrics: [
      { label: "Promedio cocina", value: "16 min", detail: "Meta 18" },
      { label: "Fuera de meta", value: "14%", detail: "de los platos" },
      {
        label: "Espera de la cuenta",
        value: "7 min",
        detail: "Pedir → cobrar",
      },
      { label: "Rotación de mesa", value: "68 min", detail: "Almuerzo" },
    ],
    columns: ["Plato", "Meta", "Real"],
    rows: [
      ["Tomahawk 1 kg", "25", "34"],
      ["Bife de chorizo", "18", "24"],
      ["Costilla BBQ", "20", "23"],
      ["Churrasco 400 g", "18", "17"],
    ],
    chart: {
      title: "Minutos promedio por hora",
      bars: [
        { label: "12", height: 173 },
        { label: "13", height: 260, tone: "stamp" },
        { label: "14", height: 235, tone: "stamp" },
        { label: "15", height: 148 },
        { label: "18", height: 161 },
        { label: "19", height: 210 },
        { label: "20", height: 272, tone: "stamp" },
        { label: "21", height: 198 },
      ],
    },
  },
  "food-cost": {
    eyebrow: "Teórico según recetas vs real según conteo",
    title: "Costo de alimentos",
    metrics: [
      { label: "Teórico", value: "—", detail: "Costo de lo vendido" },
      { label: "Real", value: "—", detail: "Conteo" },
      { label: "Brecha", value: "—", detail: "Teórico contra real" },
      { label: "Venta neta", value: "—", detail: "Con receta" },
    ],
    columns: ["Insumo", "Teórico", "Real", "Diferencia", "Valor", "Ubicación"],
    rows: [],
  },
  leakage: {
    eyebrow: "Anulaciones, descuentos y cortesías por persona",
    title: "Señales de fuga",
    metrics: [
      {
        label: "Anulado tras cocina",
        value: "$3,9 M",
        detail: "0,6% de la venta",
      },
      { label: "Descuentos", value: "$8,1 M", detail: "1,3% de la venta" },
      { label: "Cajón sin venta", value: "41", detail: "veces" },
      { label: "Faltantes de caja", value: "$412.000", detail: "6 cierres" },
    ],
    columns: [
      "Persona",
      "Rol",
      "Anulado",
      "Descuentos",
      "Sin venta",
      "Faltante",
      "Índice",
    ],
    rows: [
      ["Camilo Ruiz", "Mesero", "$1.240.000", "$310.000", "—", "—", "4,1×"],
      [
        "Paola Vega",
        "Cajera",
        "$98.000",
        "$1.920.000",
        "14",
        "$186.000",
        "3,2×",
      ],
      ["Luis Pérez", "Mesero", "$310.000", "$402.000", "—", "—", "1,1×"],
      ["Marta Ruiz", "Cajera", "$64.000", "$520.000", "3", "$0", "0,8×"],
    ],
    note: "Camilo Ruiz anula 4 veces más que el promedio del salón. 24 de 28 con el mismo supervisor, 71% en mesas de 1 cliente, entre 21:00 y 23:00.",
  },
  staff: {
    eyebrow: "Quincena 16–31 oct",
    title: "Personal y propinas",
    metrics: [
      { label: "Propinas recaudadas", value: "$14,8 M", detail: "Voluntarias" },
      {
        label: "Por tarjeta y QR",
        value: "$9,6 M",
        detail: "A pagar en nómina",
      },
      { label: "Horas trabajadas", value: "2.184 h", detail: "18 personas" },
      { label: "Venta por hora", value: "$56.800", detail: "por mesero" },
    ],
    columns: [
      "Persona",
      "Rol",
      "Horas",
      "Venta atendida",
      "Propina",
      "Ya en efectivo",
      "A pagar",
    ],
    rows: [
      [
        "Luis Pérez",
        "Mesero",
        "96",
        "$18.420.000",
        "$1.474.000",
        "$520.000",
        "$954.000",
      ],
      [
        "Ana Gómez",
        "Mesera",
        "88",
        "$16.110.000",
        "$1.289.000",
        "$410.000",
        "$879.000",
      ],
      [
        "Jorge Díaz",
        "Mesero",
        "92",
        "$14.900.000",
        "$1.192.000",
        "$600.000",
        "$592.000",
      ],
      [
        "Cocina (pozo)",
        "6 personas",
        "540",
        "—",
        "$2.960.000",
        "$0",
        "$2.960.000",
      ],
    ],
    note: "Reparto: 80% al mesero que atendió y 20% al pozo de cocina, según la regla de la sede.",
  },
  accountant: {
    eyebrow: "Solo lectura · La Parrilla SAS",
    title: "Paquete para el contador",
    metrics: [
      {
        label: "Periodo",
        value: "Octubre 2026",
        detail: "Formato Siigo · CSV",
      },
      {
        label: "Libro de ventas",
        value: "Incluido",
        detail: "Facturas, POS y notas",
      },
      { label: "Impuestos", value: "IVA e INC", detail: "Por tarifa y sede" },
      { label: "Propinas", value: "Aparte", detail: "Separadas del ingreso" },
    ],
    columns: ["Periodo", "Generado", "Estado"],
    rows: [
      ["Sep 2026", "03 oct", chip("Descargar", "ink")],
      ["Ago 2026", "02 sep", chip("Descargar", "ink")],
      ["Jul 2026", "04 ago", chip("Descargar", "ink")],
    ],
    note: "Octubre tiene 3 documentos rechazados. Se marcarán en el paquete.",
  },
  engineering: {
    eyebrow: "Octubre 2026 · popularidad y margen",
    title: "Ingeniería de menú",
    metrics: [
      { label: "Estrellas", value: "6", detail: "se piden y dejan margen" },
      { label: "Caballos", value: "4", detail: "se piden y dejan poco" },
      { label: "Puzzles", value: "3", detail: "dejan margen y no se piden" },
      { label: "Perros", value: "2", detail: "candidatos a salir" },
    ],
    columns: ["Plato", "Margen", "Percentil"],
    rows: [
      ["Churrasco 300 g", "62%", "P92 · estrella"],
      ["Bandeja paisa", "28%", "P88 · caballo"],
      ["Entraña", "71%", "P24 · puzzle"],
      ["Limonada natural", "18%", "P15 · perro"],
    ],
    chart: {
      title: "Percentil de popularidad",
      bars: [
        { label: "Chu", height: 108 },
        { label: "Bif", height: 127 },
        { label: "Ban", height: 137 },
        { label: "Emp", height: 166 },
        { label: "Lim", height: 245 },
        { label: "Ham", height: 272 },
        { label: "Pic", height: 195 },
      ],
    },
  },
  reservations: {
    eyebrow: "Reportes / reservas",
    title: "Reservas y no-show",
    metrics: [
      {
        label: "Reservas del mes",
        value: "412",
        detail: "+8% vs mes anterior",
      },
      { label: "No-show", value: "6,8%", detail: "Meta menor a 8%" },
      {
        label: "Anticipos retenidos",
        value: "$1.240.000",
        detail: "Por no llegada y cancelación tardía",
      },
      { label: "Cancelaciones", value: "31", detail: "19 con devolución" },
    ],
    columns: [
      "Fecha",
      "Reservas",
      "Llegaron",
      "No llegaron",
      "Anticipo retenido",
    ],
    rows: [
      ["Vie 6 nov", "38", "35", "3", "$180.000"],
      ["Sáb 7 nov", "52", "47", "5", "$300.000"],
      ["Dom 8 nov", "29", "27", "2", "$120.000"],
      ["Lun 9 nov", "18", "17", "1", "$60.000"],
    ],
    note: "El no-show se calcula con las reservas confirmadas. Las provisionales de un nodo sin internet se cuentan al sincronizar.",
  },
  control: {
    eyebrow: "Sede Chapinero · hoy",
    title: "Anulaciones, descuentos y arqueo",
    metrics: [
      { label: "Anulaciones", value: "3", detail: "Una después de cocina" },
      {
        label: "Descuentos sobre tope",
        value: "2",
        detail: "Ambos autoautorizados",
      },
      {
        label: "Diferencias de arqueo",
        value: "1",
        detail: "− $2.500 · Caja 1",
      },
      {
        label: "Cajón sin venta",
        value: "1",
        detail: "17:05 · motivo registrado",
      },
    ],
    columns: ["Hora", "Turno", "Acción", "Pidió", "Autorizó", "Valor"],
    rows: [
      [
        "13:44",
        "Marta R.",
        "Anulación después de cocina",
        "Marta R.",
        "Sofía L.",
        "$44.000",
      ],
      [
        "14:12",
        "Marta R.",
        "Descuento sobre tope",
        "Marta R.",
        "Laura R. (auto)",
        "$19.800",
      ],
      [
        "16:40",
        "Marta R.",
        "Cambio de medio de pago",
        "Marta R.",
        "Carolina M.",
        "$142.000",
      ],
      ["17:05", "Marta R.", "Cajón sin venta", "Marta R.", "Carolina M.", "$0"],
      [
        "22:10",
        "Caja 1",
        "Diferencia de arqueo",
        "Marta R.",
        "Pendiente",
        "− $2.500",
      ],
    ],
    note: "Patrón repetido: Marta R. tiene 3 anulaciones y 2 descuentos autoautorizados en el turno de hoy.",
  },
};

export function isReportSection(value: string): value is ReportSection {
  return reportSections.some((section) => section === value);
}
