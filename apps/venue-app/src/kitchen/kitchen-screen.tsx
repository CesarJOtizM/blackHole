import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
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
