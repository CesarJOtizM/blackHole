import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
import { VENUE_SCOPE } from "#src/service/venue-cloud.js";

const TRANSFERS_PATH = `/tenants/${encodeURIComponent(VENUE_SCOPE.tenantId)}/transfers`;
const TRANSFER_STATUS = new Set([
  "requested",
  "in_transit",
  "received",
  "received_with_differences",
]);

type TransferPost =
  | { readonly ok: true; readonly costs: readonly number[] }
  | { readonly ok: false; readonly offline: boolean };

interface VoucherLine {
  ingredientId: string;
  quantity: number;
}

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

function costsFrom(payload: unknown): number[] | null {
  if (
    !isRecord(payload) ||
    typeof payload.transferId !== "string" ||
    payload.transferId.length === 0 ||
    typeof payload.originLocationId !== "string" ||
    payload.originLocationId.length === 0 ||
    typeof payload.destinationLocationId !== "string" ||
    payload.destinationLocationId.length === 0 ||
    typeof payload.status !== "string" ||
    !TRANSFER_STATUS.has(payload.status) ||
    !Array.isArray(payload.lines) ||
    payload.lines.length === 0
  ) {
    return null;
  }

  const costs: number[] = [];

  for (const line of payload.lines) {
    if (
      !isRecord(line) ||
      typeof line.ingredientId !== "string" ||
      line.ingredientId.length === 0 ||
      typeof line.quantity !== "number" ||
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0
    ) {
      return null;
    }

    if (!Object.hasOwn(line, "unitCost")) {
      continue;
    }

    if (
      typeof line.unitCost !== "number" ||
      !Number.isInteger(line.unitCost) ||
      line.unitCost < 0
    ) {
      return null;
    }

    costs.push(line.unitCost);
  }

  return costs;
}

function voucherFrom(
  raw: string,
): { transferId: string; lines: VoucherLine[] } | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.transferId !== "string" ||
    parsed.transferId.trim().length === 0 ||
    !Array.isArray(parsed.lines) ||
    parsed.lines.length === 0
  ) {
    return null;
  }

  const lines: VoucherLine[] = [];

  for (const line of parsed.lines) {
    if (
      !isRecord(line) ||
      typeof line.ingredientId !== "string" ||
      line.ingredientId.trim().length === 0 ||
      typeof line.quantity !== "number" ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0
    ) {
      return null;
    }

    lines.push({
      ingredientId: line.ingredientId.trim(),
      quantity: line.quantity,
    });
  }

  return { transferId: parsed.transferId.trim(), lines };
}

async function postTransfer(
  path: string,
  body: unknown,
): Promise<TransferPost> {
  try {
    const response = await fetch(path, {
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
      return { ok: false, offline: false };
    }

    const costs = costsFrom(await response.json());

    if (costs === null) {
      return { ok: false, offline: false };
    }

    return { ok: true, costs };
  } catch {
    return { ok: false, offline: true };
  }
}

function showTransfer(
  result: TransferPost,
  success: string,
  failure: string,
  setCosts: (costs: readonly number[]) => void,
  setStatus: (status: string) => void,
) {
  if (result.ok) {
    setCosts(result.costs);
    setStatus(success);
    return;
  }

  setCosts([]);
  setStatus(
    result.offline
      ? "No se puede registrar hasta que vuelva la conexión."
      : failure,
  );
}

export function TransferScreen() {
  const [originLocationId, setOriginLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transferId, setTransferId] = useState("");
  const [actorId, setActorId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [voucherText, setVoucherText] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [authorizerId, setAuthorizerId] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState("");
  const [costs, setCosts] = useState<readonly number[]>([]);

  async function requestTransfer() {
    const amount = counted(quantity, false);
    const origin = originLocationId.trim();
    const destination = destinationLocationId.trim();
    const ingredient = ingredientId.trim();

    if (
      origin.length === 0 ||
      destination.length === 0 ||
      ingredient.length === 0 ||
      amount === null
    ) {
      setCosts([]);
      setStatus("Revisa el traslado.");
      return;
    }

    showTransfer(
      await postTransfer(TRANSFERS_PATH, {
        transferId: requestId,
        originLocationId: origin,
        destinationLocationId: destination,
        lines: [{ ingredientId: ingredient, quantity: amount }],
      }),
      "Traslado solicitado.",
      "El traslado no quedó registrado.",
      setCosts,
      setStatus,
    );
  }

  async function dispatchTransfer() {
    const id = transferId.trim();
    const actor = actorId.trim();
    const device = deviceId.trim();

    if (id.length === 0 || actor.length === 0 || device.length === 0) {
      setCosts([]);
      setStatus("Revisa el traslado.");
      return;
    }

    showTransfer(
      await postTransfer(
        `${TRANSFERS_PATH}/${encodeURIComponent(id)}/dispatch`,
        {
          actorId: actor,
          deviceId: device,
        },
      ),
      "Traslado despachado.",
      "El despacho no quedó registrado.",
      setCosts,
      setStatus,
    );
  }

  async function receiveTransfer() {
    const voucher = voucherFrom(voucherText);
    const received = counted(receivedQuantity, true);
    const authorizer = authorizerId.trim();

    if (voucher === null || received === null) {
      setCosts([]);
      setStatus("Revisa el traslado.");
      return;
    }

    showTransfer(
      await postTransfer(
        `${TRANSFERS_PATH}/${encodeURIComponent(voucher.transferId)}/receipt`,
        {
          lines: voucher.lines.map((line) => ({
            ingredientId: line.ingredientId,
            receivedQuantity: received,
          })),
          ...(authorizer.length === 0 ? {} : { authorizerId: authorizer }),
        },
      ),
      "Recepción registrada.",
      "La recepción no quedó registrada.",
      setCosts,
      setStatus,
    );
  }

  return (
    <section className="grid max-w-md gap-4">
      <header>
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          En la sede
        </p>
        <h1 className="font-display text-title">Traslados</h1>
      </header>
      <Field
        label="Origen"
        value={originLocationId}
        onChange={(event) => setOriginLocationId(event.target.value)}
      />
      <Field
        label="Destino"
        value={destinationLocationId}
        onChange={(event) => setDestinationLocationId(event.target.value)}
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
        label="Traslado"
        value={transferId}
        onChange={(event) => setTransferId(event.target.value)}
      />
      <Field
        label="Actor"
        value={actorId}
        onChange={(event) => setActorId(event.target.value)}
      />
      <Field
        label="Dispositivo"
        value={deviceId}
        onChange={(event) => setDeviceId(event.target.value)}
      />
      <Field
        label="QR"
        value={voucherText}
        onChange={(event) => setVoucherText(event.target.value)}
      />
      <Field
        label="Cantidad recibida"
        inputMode="numeric"
        value={receivedQuantity}
        onChange={(event) => setReceivedQuantity(event.target.value)}
      />
      <Field
        label="Autorizador"
        value={authorizerId}
        onChange={(event) => setAuthorizerId(event.target.value)}
      />
      <Button
        onClick={() => {
          void requestTransfer();
        }}
      >
        Solicitar traslado
      </Button>
      <Button
        onClick={() => {
          void dispatchTransfer();
        }}
      >
        Despachar
      </Button>
      <Button
        onClick={() => {
          void receiveTransfer();
        }}
      >
        Recibir por QR
      </Button>
      {status.length > 0 ? <p role="status">{status}</p> : null}
      {costs.map((cost, index) => (
        <p key={`${index}-${cost}`}>Costo unitario {cost}</p>
      ))}
    </section>
  );
}
