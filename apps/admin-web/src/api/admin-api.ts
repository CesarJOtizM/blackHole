const SESSION_HEADER = "x-session-id";

export const ADMIN_SCOPE = {
  tenantId: "pilot",
  venueId: "chapinero",
  sessionId: "admin-web",
} as const;

export type ScarcityState = "open" | "seen" | "resolved";
export type ScarcityRoute = "warehouse" | "purchase";

export interface ScarcityAlert {
  id: string;
  name: string;
  state: ScarcityState;
  route: ScarcityRoute;
  pointBalance: string;
  minimum: string;
  reorderPoint: string;
  warehouseBalance: string;
  venueBalance: string;
}

export interface FactusDocument {
  id: string;
  name: string;
  state: string;
}

export interface Contributor {
  id: string;
  name: string;
  nit: string;
  state: string;
}

export interface CloudResult {
  status: number;
  body: unknown;
}

const scarcitySeed = (): ScarcityAlert[] => [
  {
    id: "papa-criolla",
    name: "Papa criolla",
    state: "open",
    route: "warehouse",
    pointBalance: "14 kg",
    minimum: "20 kg",
    reorderPoint: "40 kg",
    warehouseBalance: "86 kg",
    venueBalance: "14 kg en Chapinero",
  },
  {
    id: "entrana",
    name: "Entraña",
    state: "seen",
    route: "purchase",
    pointBalance: "0 kg",
    minimum: "6 kg",
    reorderPoint: "20 kg",
    warehouseBalance: "0 kg",
    venueBalance: "0 kg en Chapinero",
  },
  {
    id: "churrasco",
    name: "Churrasco (pieza)",
    state: "open",
    route: "warehouse",
    pointBalance: "6,2 kg",
    minimum: "12 kg",
    reorderPoint: "40 kg",
    warehouseBalance: "28 kg",
    venueBalance: "6,2 kg en Chapinero",
  },
];

const factusSeed = (): FactusDocument[] => [
  { id: "chamber", name: "Cámara de Comercio", state: "Recibido" },
  { id: "rut", name: "RUT", state: "Recibido" },
  { id: "id-card", name: "Cédula del representante", state: "Falta" },
  { id: "range", name: "Rango de numeración DIAN", state: "En revisión" },
  { id: "certificate", name: "Certificado digital", state: "Falta" },
];

const contributorSeed = (): Contributor[] => [
  {
    id: "parrilla",
    name: "La Parrilla SAS",
    nit: "901.112.334-5",
    state: "Listo para emitir",
  },
];

let scarcity = scarcitySeed();
let factusDocuments = factusSeed();
let contributors = contributorSeed();
let selectedScarcityId = "papa-criolla";

export function resetAdminSamples(): void {
  scarcity = scarcitySeed();
  factusDocuments = factusSeed();
  contributors = contributorSeed();
  selectedScarcityId = "papa-criolla";
}

export function listScarcity(state: ScarcityState | "all"): ScarcityAlert[] {
  if (state === "all") {
    return scarcity.map((alert) => ({ ...alert }));
  }

  return scarcity
    .filter((alert) => alert.state === state)
    .map((alert) => ({ ...alert }));
}

export function selectScarcity(id: string): ScarcityAlert | null {
  const found = scarcity.find((alert) => alert.id === id);

  if (!found) {
    return null;
  }

  selectedScarcityId = found.id;

  if (found.state === "open") {
    found.state = "seen";
  }

  return { ...found };
}

export function selectedScarcity(): ScarcityAlert {
  const found =
    scarcity.find((alert) => alert.id === selectedScarcityId) ?? scarcity[0];

  if (!found) {
    throw new Error("Scarcity sample is empty");
  }

  return { ...found };
}

export function requestFromWarehouse(id: string): string {
  const found = scarcity.find((alert) => alert.id === id);

  if (found?.route !== "warehouse") {
    return "Ese insumo no se pide a la bodega.";
  }

  found.state = "resolved";
  return `Pedido a la bodega general por ${found.name}.`;
}

export function orderPurchase(id: string): string {
  const found = scarcity.find((alert) => alert.id === id);

  if (found?.route !== "purchase") {
    return "Ese insumo no abre una compra.";
  }

  found.state = "resolved";
  return `Orden de compra abierta para ${found.name}.`;
}

export function listFactusDocuments(): FactusDocument[] {
  return factusDocuments.map((document) => ({ ...document }));
}

export function askForFactusDocuments(): string {
  for (const document of factusDocuments) {
    if (document.state === "Falta") {
      document.state = "Pedido";
    }
  }

  return "Se pidieron los documentos que faltan del NIT.";
}

export function continueWithoutIssuing(): string {
  return "El alta sigue sin emitir documentos.";
}

export function listContributors(): Contributor[] {
  return contributors.map((contributor) => ({ ...contributor }));
}

export function addContributor(name: string, nit: string): string | null {
  const trimmedName = name.trim();
  const trimmedNit = nit.trim();

  if (trimmedName.length === 0 || trimmedNit.length === 0) {
    return "Escribe el nombre y el NIT.";
  }

  contributors = [
    ...contributors,
    {
      id: `contributor-${contributors.length + 1}`,
      name: trimmedName,
      nit: trimmedNit,
      state: "Documentos pendientes",
    },
  ];

  return null;
}

export function auditPath(tenantId: string): string {
  const params = new URLSearchParams({ tenantId });
  return `/audit?${params.toString()}`;
}

export function attendancePath(kind: "read" | "policy" | "export"): string {
  const base = `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/venues/${encodeURIComponent(ADMIN_SCOPE.venueId)}`;

  if (kind === "policy") {
    return `${base}/attendance/policy`;
  }

  if (kind === "export") {
    return `${base}/attendance/export`;
  }

  return `${base}/attendance`;
}

export function controlReportPath(): string {
  return `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/venues/${encodeURIComponent(ADMIN_SCOPE.venueId)}/control-report`;
}

export function unusualBehaviorPath(shiftId: string): string {
  const params = new URLSearchParams({ shiftId });
  return `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/venues/${encodeURIComponent(ADMIN_SCOPE.venueId)}/unusual-behavior?${params.toString()}`;
}

export function identityPath(): string {
  return `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/identity`;
}

export async function cloudCall(
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
): Promise<CloudResult> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: {
      accept: "application/json",
      [SESSION_HEADER]: ADMIN_SCOPE.sessionId,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed: unknown = null;

  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  return { status: response.status, body: parsed };
}

function eventCount(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("events" in body)) {
    return null;
  }

  const events = body.events;
  return Array.isArray(events) ? events.length : null;
}

function workerCount(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("workers" in body)) {
    return null;
  }

  const workers = body.workers;
  return Array.isArray(workers) ? workers.length : null;
}

export async function readAuditFromCloud(): Promise<string> {
  const result = await cloudCall(auditPath(ADMIN_SCOPE.tenantId), "GET");
  const count = eventCount(result.body);

  if (result.status !== 200 || count === null) {
    return "La auditoría en pantalla es la muestra. La nube no devolvió eventos.";
  }

  return `La nube devolvió ${count} eventos de auditoría.`;
}

export async function readAttendanceFromCloud(): Promise<string> {
  const result = await cloudCall(attendancePath("read"), "GET");
  const count = workerCount(result.body);

  if (result.status !== 200 || count === null) {
    return "Las horas en pantalla son la muestra. La nube no devolvió marcaciones.";
  }

  return `La nube devolvió ${count} personas con horas.`;
}

export async function saveAttendancePolicyToCloud(): Promise<string> {
  const result = await cloudCall(attendancePath("policy"), "PUT", {
    mode: "scheduled",
    geofence: null,
    toleranceMinutes: 10,
    closeTime: "23:00",
    operationRuleEnabled: true,
    schedule: { startsAt: "11:00", endsAt: "23:00" },
  });

  if (result.status !== 200) {
    return "Las reglas quedaron guardadas en esta sesión. La nube no las recibió.";
  }

  return "Las reglas quedaron guardadas en la nube.";
}

export async function exportAttendanceFromCloud(): Promise<string> {
  const result = await cloudCall(attendancePath("export"), "POST", {
    from: "2026-11-03",
    to: "2026-11-09",
  });

  if (result.status !== 200) {
    return "La exportación de horas queda lista en esta sesión.";
  }

  return "La nube entregó el libro de horas.";
}

export async function readControlReportFromCloud(): Promise<string> {
  const result = await cloudCall(controlReportPath(), "GET");

  if (result.status !== 200) {
    return "El control del día en pantalla es la muestra.";
  }

  return "El control del día salió de la nube.";
}

export async function readUnusualBehaviorFromCloud(): Promise<string> {
  const result = await cloudCall(unusualBehaviorPath("current"), "GET");

  if (result.status !== 200) {
    return "El antirrobo en pantalla es la muestra.";
  }

  return "La nube respondió el antirrobo del turno.";
}

export async function signInAdministration(
  email: string,
  password: string,
): Promise<void> {
  await cloudCall(identityPath(), "POST", {
    siteOffline: false,
    command: {
      type: "signInAdministration",
      userId: email,
      password,
      factorCode: null,
      sessionId: ADMIN_SCOPE.sessionId,
    },
  });
}
