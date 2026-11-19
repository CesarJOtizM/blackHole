import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
import { VENUE_SCOPE } from "#src/service/venue-cloud.js";

const RECEIPT_PATH = `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/purchase-receipts`;

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

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonnegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function averagesFrom(payload: unknown): number[] | null {
  if (
    !isRecord(payload) ||
    typeof payload.receiptId !== "string" ||
    payload.receiptId.length === 0 ||
    typeof payload.locationId !== "string" ||
    payload.locationId.length === 0 ||
    !Array.isArray(payload.lines) ||
    payload.lines.length === 0
  ) {
    return null;
  }

  if (
    payload.purchaseOrderId !== null &&
    (typeof payload.purchaseOrderId !== "string" ||
      payload.purchaseOrderId.length === 0)
  ) {
    return null;
  }

  const averages: number[] = [];

  for (const line of payload.lines) {
    if (
      !isRecord(line) ||
      typeof line.ingredientId !== "string" ||
      line.ingredientId.length === 0 ||
      !positiveInt(line.purchaseQuantity) ||
      !nonnegativeInt(line.purchaseUnitCost) ||
      !positiveInt(line.factor) ||
      !positiveInt(line.quantity) ||
      !nonnegativeInt(line.unitCost)
    ) {
      return null;
    }

    if (!Object.hasOwn(line, "averageCost")) {
      continue;
    }

    if (!nonnegativeInt(line.averageCost)) {
      return null;
    }

    averages.push(line.averageCost);
  }

  return averages;
}

export function ReceiveScreen() {
  const [locationId, setLocationId] = useState<string>(VENUE_SCOPE.venueId);
  const [orderId, setOrderId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [receiptId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState("");
  const [averages, setAverages] = useState<readonly number[]>([]);

  async function receive() {
    const purchaseQuantity = counted(quantity, false);
    const purchaseUnitCost = counted(unitCost, true);
    const ingredient = ingredientId.trim();
    const location = locationId.trim();

    if (
      ingredient.length === 0 ||
      location.length === 0 ||
      purchaseQuantity === null ||
      purchaseUnitCost === null
    ) {
      setAverages([]);
      setStatus("Revisa la cantidad y el costo.");
      return;
    }

    const order = orderId.trim();

    try {
      const response = await fetch(RECEIPT_PATH, {
        method: "POST",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-session-id": VENUE_SCOPE.sessionId,
        },
        body: JSON.stringify({
          receiptId,
          locationId: location,
          ...(order.length === 0 ? {} : { purchaseOrderId: order }),
          lines: [
            {
              ingredientId: ingredient,
              purchaseQuantity,
              purchaseUnitCost,
            },
          ],
        }),
      });

      if (!response.ok) {
        setAverages([]);
        setStatus("La recepción no quedó registrada.");
        return;
      }

      const shown = averagesFrom(await response.json());

      if (shown === null) {
        setAverages([]);
        setStatus("La recepción no quedó registrada.");
        return;
      }

      setAverages(shown);
      setStatus("Recepción registrada.");
    } catch {
      setAverages([]);
      setStatus("No se puede registrar hasta que vuelva la conexión.");
    }
  }

  return (
    <section className="grid max-w-md gap-4">
      <header>
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          En la sede
        </p>
        <h1 className="font-display text-title">Recepción</h1>
      </header>
      <Field
        label="Ubicación"
        value={locationId}
        onChange={(event) => setLocationId(event.target.value)}
      />
      <Field
        label="Orden"
        value={orderId}
        onChange={(event) => setOrderId(event.target.value)}
      />
      <Field
        label="Insumo"
        value={ingredientId}
        onChange={(event) => setIngredientId(event.target.value)}
      />
      <Field
        label="Cantidad"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <Field
        label="Costo unitario"
        inputMode="numeric"
        value={unitCost}
        onChange={(event) => setUnitCost(event.target.value)}
      />
      <Button
        onClick={() => {
          void receive();
        }}
      >
        Registrar recepción
      </Button>
      {status.length > 0 ? <p role="status">{status}</p> : null}
      {averages.map((cost, index) => (
        <p key={`${index}-${cost}`}>Costo promedio {cost}</p>
      ))}
    </section>
  );
}
