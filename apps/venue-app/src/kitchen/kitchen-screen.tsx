import { Button, Field } from "@blackhole/ui";
import { useEffect, useState } from "react";
import { useService } from "#src/service/service-session.js";
import { VENUE_SCOPE } from "#src/service/venue-cloud.js";

const RUN_PATH = `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/production-runs`;

function counted(value: string, allowZero: boolean): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || (!allowZero && parsed === 0)) {
    return null;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonnegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function shownVariance(payload: unknown): number | null | undefined {
  if (
    !isRecord(payload) ||
    !text(payload.runId) ||
    !text(payload.locationId) ||
    !text(payload.recipeId) ||
    !positiveInt(payload.expectedQuantity) ||
    !nonnegativeInt(payload.actualQuantity)
  ) {
    return undefined;
  }

  if (!Object.hasOwn(payload, "variance")) {
    return null;
  }

  if (!integer(payload.variance)) {
    return undefined;
  }

  return payload.variance;
}

const REALTIME_PATH = `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/venues/${encodeURIComponent(VENUE_SCOPE.venueId)}/shortage-realtime`;

const SEVERITY_LABEL = {
  yellow: "Alerta amarilla",
  red: "Alerta roja",
  critical: "Alerta crítica",
} as const;

const KIND_LABEL = {
  level: "Nivel",
  coverage: "Cobertura",
  dish: "Plato",
} as const;

type ShortageKind = keyof typeof KIND_LABEL;
type ShortageSeverity = keyof typeof SEVERITY_LABEL;

interface ShortageNoticeView {
  alertId: string;
  kind: ShortageKind;
  severity: ShortageSeverity;
  role: string;
  venueId: string;
}

function restockPath(alertId: string): string {
  return `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/venues/${encodeURIComponent(VENUE_SCOPE.venueId)}/shortage-alerts/${encodeURIComponent(alertId)}/restock`;
}

function isKind(value: string): value is ShortageKind {
  return value === "level" || value === "coverage" || value === "dish";
}

function isSeverity(value: string): value is ShortageSeverity {
  return value === "yellow" || value === "red" || value === "critical";
}

function isRole(value: string): boolean {
  return value === "siteAdministrator" || value === "generalManager";
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function shownNotice(value: unknown): ShortageNoticeView | null {
  if (!isRecord(value)) {
    return null;
  }

  const alertId = value.alertId;
  const kind = value.kind;
  const severity = value.severity;
  const role = value.role;

  if (
    typeof alertId !== "string" ||
    alertId.length === 0 ||
    typeof kind !== "string" ||
    !isKind(kind) ||
    typeof severity !== "string" ||
    !isSeverity(severity) ||
    typeof role !== "string" ||
    !isRole(role) ||
    value.venueId !== VENUE_SCOPE.venueId
  ) {
    return null;
  }

  return {
    alertId,
    kind,
    severity,
    role,
    venueId: VENUE_SCOPE.venueId,
  };
}

function noticeFromFrame(frame: string): ShortageNoticeView | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("");

  if (data.length === 0) {
    return null;
  }

  return shownNotice(readJson(data));
}

async function readShortageNotices(
  signal: AbortSignal,
  onNotice: (notice: ShortageNoticeView) => void,
): Promise<void> {
  try {
    const response = await fetch(REALTIME_PATH, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "text/event-stream",
        "x-session-id": VENUE_SCOPE.sessionId,
      },
      signal,
    });

    if (!response.ok || response.body === null) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";

    while (!signal.aborted) {
      const chunk = await reader.read();

      if (chunk.done) {
        const notice = noticeFromFrame(pending);

        if (notice && !signal.aborted) {
          onNotice(notice);
        }

        return;
      }

      pending += decoder.decode(chunk.value, { stream: true });
      const frames = pending.split("\n\n");
      pending = frames.pop() ?? "";

      for (const frame of frames) {
        const notice = noticeFromFrame(frame);

        if (notice && !signal.aborted) {
          onNotice(notice);
        }
      }
    }
  } catch {
    return;
  }
}

async function restockAlert(
  alertId: string,
  setStatus: (status: string) => void,
): Promise<void> {
  try {
    const response = await fetch(restockPath(alertId), {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-session-id": VENUE_SCOPE.sessionId,
      },
      body: JSON.stringify({
        purchaseUnit: 1,
        documentId: crypto.randomUUID(),
        lineId: crypto.randomUUID(),
        warehouseId: null,
        supplierId: null,
      }),
    });

    if (!response.ok) {
      setStatus("La reposición no quedó registrada.");
      return;
    }

    const payload: unknown = await response.json();

    setStatus(
      isRecord(payload) && payload.outcome === "purchase-order"
        ? "Se ofreció una orden de compra."
        : "Reposición registrada.",
    );
  } catch {
    setStatus("No se puede registrar hasta que vuelva la conexión.");
  }
}

export function ShortageNoticePanel() {
  const [notices, setNotices] = useState<readonly ShortageNoticeView[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void readShortageNotices(controller.signal, (notice) => {
      setNotices((current) => [
        ...current.filter((item) => item.alertId !== notice.alertId),
        notice,
      ]);
    });

    return () => {
      controller.abort();
    };
  }, []);

  if (notices.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      {notices.map((notice) => (
        <article key={notice.alertId} className="grid gap-2">
          <h2 className="font-display text-title">Alerta de faltante</h2>
          <p>{SEVERITY_LABEL[notice.severity]}</p>
          <p>{KIND_LABEL[notice.kind]}</p>
          <p>{notice.alertId}</p>
          <Button
            onClick={() => {
              void restockAlert(notice.alertId, setStatus);
            }}
          >
            Reponer
          </Button>
        </article>
      ))}
      {status.length > 0 ? <p role="status">{status}</p> : null}
    </section>
  );
}

export function KitchenScreen() {
  const service = useService();
  const open = service.tickets.filter((ticket) => !ticket.ready);
  const done = service.tickets.filter((ticket) => ticket.ready);
  const [locationId, setLocationId] = useState(VENUE_SCOPE.venueId);
  const [recipeId, setRecipeId] = useState("");
  const [expectedQuantity, setExpectedQuantity] = useState("");
  const [actualQuantity, setActualQuantity] = useState("");
  const [runId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState("");
  const [variance, setVariance] = useState<number | null>(null);

  async function record() {
    const expected = counted(expectedQuantity, false);
    const actual = counted(actualQuantity, true);
    const recipe = recipeId.trim();
    const location = locationId.trim();

    if (
      recipe.length === 0 ||
      location.length === 0 ||
      expected === null ||
      actual === null
    ) {
      setVariance(null);
      setStatus("Revisa la cantidad y la receta.");
      return;
    }

    try {
      const response = await fetch(RUN_PATH, {
        method: "POST",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-session-id": VENUE_SCOPE.sessionId,
        },
        body: JSON.stringify({
          runId,
          locationId: location,
          recipeId: recipe,
          expectedQuantity: expected,
          actualQuantity: actual,
        }),
      });

      if (!response.ok) {
        setVariance(null);
        setStatus("La producción no quedó registrada.");
        return;
      }

      const shown = shownVariance(await response.json());

      if (shown === undefined) {
        setVariance(null);
        setStatus("La producción no quedó registrada.");
        return;
      }

      setVariance(shown);
      setStatus("Producción registrada.");
    } catch {
      setVariance(null);
      setStatus("No se puede registrar hasta que vuelva la conexión.");
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl bg-kitchen-surface p-4 text-kitchen-ink">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wide uppercase">
            Parrilla · Chapinero
          </p>
          <h1 className="font-display text-title">Cocina</h1>
        </div>
        <p className="font-mono text-numeral">{open.length}</p>
      </header>
      <ShortageNoticePanel />
      <div className="grid gap-3 md:grid-cols-2">
        {open.map((ticket) => {
          const late = ticket.minutes >= 12;
          return (
            <article
              key={ticket.id}
              className={`grid gap-3 rounded-2xl border-2 p-4 ${late ? "border-kitchen-late" : "border-kitchen-ok"}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-title">
                  Mesa {ticket.tableLabel}
                  {ticket.channel === "qr_table" ? (
                    <span className="block font-mono text-xs uppercase">
                      QR table
                    </span>
                  ) : null}
                </h2>
                <p className={late ? "text-kitchen-late" : "text-kitchen-ok"}>
                  {ticket.minutes} min
                </p>
              </div>
              <p className="font-mono text-sm uppercase">{ticket.course}</p>
              <ul className="grid gap-1">
                {ticket.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Button onClick={() => service.markTicketReady(ticket.id)}>
                Listo
              </Button>
            </article>
          );
        })}
      </div>
      {done.length > 0 ? (
        <p className="text-kitchen-ok">
          Listos: {done.map((ticket) => `mesa ${ticket.tableLabel}`).join(", ")}
        </p>
      ) : null}
      <div className="grid max-w-md gap-3">
        <h2 className="font-display text-title">Producción</h2>
        <Field
          label="Ubicación"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        />
        <Field
          label="Receta"
          value={recipeId}
          onChange={(event) => setRecipeId(event.target.value)}
        />
        <Field
          label="Cantidad esperada"
          inputMode="numeric"
          value={expectedQuantity}
          onChange={(event) => setExpectedQuantity(event.target.value)}
        />
        <Field
          label="Cantidad real"
          inputMode="numeric"
          value={actualQuantity}
          onChange={(event) => setActualQuantity(event.target.value)}
        />
        <Button
          onClick={() => {
            void record();
          }}
        >
          Registrar producción
        </Button>
        {status.length > 0 ? <p role="status">{status}</p> : null}
        {variance === null ? null : <p>Variación {variance}</p>}
      </div>
      {service.notice ? <p role="status">{service.notice}</p> : null}
    </section>
  );
}
