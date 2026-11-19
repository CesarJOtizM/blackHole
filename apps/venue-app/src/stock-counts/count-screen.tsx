import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
import { VENUE_SCOPE } from "#src/service/venue-cloud.js";

const venueBase = `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/venues/${encodeURIComponent(VENUE_SCOPE.venueId)}`;

interface DifferenceLine {
  ingredientId: string;
  quantity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function counted(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function ingredientIdsFrom(payload: unknown): string[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.ingredientIds)) {
    return null;
  }

  const ids: string[] = [];

  for (const id of payload.ingredientIds) {
    if (typeof id !== "string" || id.trim().length === 0) {
      return null;
    }

    ids.push(id);
  }

  return ids;
}

function differencesFrom(
  payload: unknown,
): DifferenceLine[] | "pending" | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.posted === false) {
    return payload.outcome === "requires_authorization" ? "pending" : null;
  }

  if (payload.posted !== true || !Array.isArray(payload.lines)) {
    return null;
  }

  const lines: DifferenceLine[] = [];

  for (const line of payload.lines) {
    if (
      !isRecord(line) ||
      typeof line.ingredientId !== "string" ||
      line.ingredientId.length === 0 ||
      typeof line.quantity !== "number" ||
      !Number.isInteger(line.quantity)
    ) {
      return null;
    }

    lines.push({
      ingredientId: line.ingredientId,
      quantity: line.quantity,
    });
  }

  return lines;
}

async function readSheet(
  locationId: string,
  cutOff: string,
): Promise<string[] | null> {
  const params = new URLSearchParams({
    locationId,
    cutOff,
    scope: "full",
  });

  try {
    const response = await fetch(`${venueBase}/stock-count-sheets?${params}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "x-session-id": VENUE_SCOPE.sessionId,
      },
    });

    if (!response.ok) {
      return null;
    }

    return ingredientIdsFrom(await response.json());
  } catch {
    return null;
  }
}

async function sendCount(
  body: unknown,
): Promise<DifferenceLine[] | "pending" | null> {
  try {
    const response = await fetch(`${venueBase}/stock-counts`, {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-session-id": VENUE_SCOPE.sessionId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    return differencesFrom(await response.json());
  } catch {
    return null;
  }
}

export function StockCountScreen() {
  const [locationId, setLocationId] = useState("");
  const [cutOff, setCutOff] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [ingredientIds, setIngredientIds] = useState<readonly string[]>([]);
  const [quantities, setQuantities] = useState<
    Readonly<Record<string, string>>
  >({});
  const [differences, setDifferences] = useState<readonly DifferenceLine[]>([]);
  const [status, setStatus] = useState("");

  async function openCount() {
    const location = locationId.trim();
    const limit = cutOff.trim();

    if (location.length === 0 || limit.length === 0) {
      setStatus("Revisa el conteo.");
      return;
    }

    const ids = await readSheet(location, limit);

    if (ids === null) {
      setIngredientIds([]);
      setDifferences([]);
      setStatus("No se pudo abrir el conteo.");
      return;
    }

    setIngredientIds(ids);
    setQuantities(Object.fromEntries(ids.map((id) => [id, ""])));
    setDifferences([]);
    setStatus("");
  }

  async function submitCount() {
    const location = locationId.trim();
    const limit = cutOff.trim();
    const document = documentId.trim();
    const lines: { ingredientId: string; purchaseQuantity: number }[] = [];

    if (location.length === 0 || limit.length === 0 || document.length === 0) {
      setStatus("Revisa el conteo.");
      return;
    }

    for (const ingredientId of ingredientIds) {
      const purchaseQuantity = counted(quantities[ingredientId] ?? "");

      if (purchaseQuantity === null) {
        setStatus("Revisa el conteo.");
        return;
      }

      lines.push({ ingredientId, purchaseQuantity });
    }

    const result = await sendCount({
      locationId: location,
      documentId: document,
      cutOff: limit,
      scope: "full",
      lines,
    });

    if (result === null) {
      setDifferences([]);
      setStatus("El conteo no quedó registrado.");
      return;
    }

    if (result === "pending") {
      setDifferences([]);
      setStatus("Pendiente de aprobación.");
      return;
    }

    setDifferences(result);
    setStatus("Conteo registrado.");
  }

  return (
    <section className="grid max-w-md gap-4">
      <header>
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          En la sede
        </p>
        <h1 className="font-display text-title">Conteo</h1>
      </header>
      <Field
        label="Ubicación"
        value={locationId}
        onChange={(event) => setLocationId(event.target.value)}
      />
      <Field
        label="Corte"
        value={cutOff}
        onChange={(event) => setCutOff(event.target.value)}
      />
      <Field
        label="Documento"
        value={documentId}
        onChange={(event) => setDocumentId(event.target.value)}
      />
      <Button onClick={() => void openCount()}>Abrir conteo</Button>
      {ingredientIds.map((ingredientId) => (
        <Field
          key={ingredientId}
          label={ingredientId}
          inputMode="numeric"
          value={quantities[ingredientId] ?? ""}
          onChange={(event) =>
            setQuantities((current) => ({
              ...current,
              [ingredientId]: event.target.value,
            }))
          }
        />
      ))}
      {ingredientIds.length > 0 ? (
        <Button onClick={() => void submitCount()}>Enviar conteo</Button>
      ) : null}
      {differences.map((line) => (
        <p key={line.ingredientId}>
          Diferencia {line.ingredientId} {line.quantity}
        </p>
      ))}
      {status.length > 0 ? <p>{status}</p> : null}
    </section>
  );
}
