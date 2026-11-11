export const homeMetrics = [
  { label: "Ventas hoy", value: "$14,8M", detail: "+9% vs jueves pasado" },
  { label: "Ticket promedio", value: "$71.200", detail: "+3%" },
  { label: "Food cost semana", value: "31,4%", detail: "+1,2 pts sobre meta" },
  { label: "Facturas pendientes DIAN", value: "3", detail: "1 rechazada" },
] as const;

export const liveVenues = [
  ["Chapinero", "Híbrido", "$4.812.000", "9/14", "18m", "Atraso"],
  ["Usaquén", "Nube", "$5.106.000", "12/18", "12m", "Normal"],
  ["Cedritos", "Nube", "$3.044.000", "6/12", "11m", "Normal"],
  ["Salitre", "Nube", "$1.838.000", "—", "14m", "Rappi pausado"],
] as const;

export const attention = [
  {
    id: "invoice",
    title: "Factura rechazada por la DIAN",
    detail: "FECH 18839 · NIT inválido · Chapinero",
    to: "/fiscal/documents",
  },
  {
    id: "cash",
    title: "Diferencia de caja firmada",
    detail: "Faltan $11.500 · turno de Marta · Chapinero",
    to: "/audit",
  },
  {
    id: "stock",
    title: "Camarón bajo mínimo en 2 sedes",
    detail: "Sugerido: OC a Mariscos del Pacífico",
    to: "/inventory",
  },
  {
    id: "bag",
    title: "Bolsa de documentos al 18%",
    detail: "Alcanza ~6 días al ritmo actual",
    to: "/plan/bag",
  },
] as const;
