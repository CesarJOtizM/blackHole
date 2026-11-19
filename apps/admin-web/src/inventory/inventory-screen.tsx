import {
  productionCostPolicy,
  productionRun,
  purchaseReceipt,
  recordedTransfer,
} from "@blackhole/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ADMIN_SCOPE } from "#src/api/admin-api.js";
import { TextField } from "#src/catalog/text-field.js";
import {
  ConsolidatedView,
  RecipeView,
  SuppliesView,
} from "#src/inventory/inventory-view.js";
import { NoticeToast } from "#src/shell/notice-toast.js";
import { RecordPage } from "#src/shell/record-page.js";

export function SuppliesScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<
    "all" | "low" | "meat" | "dairy" | "drinks" | "packaging"
  >("all");
  const [notice, setNotice] = useState("");
  return (
    <>
      <SuppliesView
        tab={tab}
        onTab={setTab}
        onImportFile={(file) =>
          setNotice(`El archivo ${file.name} queda listo en esta sesión.`)
        }
        onCreate={(name) =>
          setNotice(`${name} queda en el catálogo de esta sesión.`)
        }
        onOrder={() =>
          setNotice(
            "Se crearon las órdenes sugeridas por $2.184.000 en esta sesión.",
          )
        }
        onRecipe={() => {
          void navigate({ to: "/inventory/recipes/churrasco" });
        }}
        onPurchase={() => {
          void navigate({ to: "/inventory/orders/oc-0418" });
        }}
        onConsolidated={() => {
          void navigate({ to: "/inventory/consolidated" });
        }}
        onTransfers={() => {
          void navigate({ to: "/inventory/transfers" });
        }}
        onScarcity={() => {
          void navigate({ to: "/inventory/scarcity" });
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
  );
}

export function RecipeScreen() {
  const [status, setStatus] = useState("");
  return (
    <RecipeView
      status={status}
      onSave={() => setStatus("La receta quedó guardada en esta sesión.")}
    />
  );
}

const RECEIPT_PATH = `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/purchase-receipts`;
const RUN_PATH = `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/production-runs`;
const POLICY_PATH = `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/venues/${encodeURIComponent(ADMIN_SCOPE.venueId)}/production-cost-policy`;
const TRANSFERS_PATH = `/tenants/${encodeURIComponent(ADMIN_SCOPE.tenantId)}/transfers`;
const ORDER_ID = "oc-0418";

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

function averagesFrom(payload: unknown): number[] | null {
  const parsed = purchaseReceipt.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.lines.flatMap((line) =>
    line.averageCost === undefined ? [] : [line.averageCost],
  );
}

function shownVariance(
  payload: unknown,
): { readonly variance: number | null } | null {
  const parsed = productionRun.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  return {
    variance: parsed.data.variance === undefined ? null : parsed.data.variance,
  };
}

function preparationsFor(
  rule: "consumed_average" | "standard",
  preparationId: string,
  standardCost: string,
): { recipeId: string; standardUnitCost: number }[] | null {
  const preparation = preparationId.trim();
  const hasPreparation = preparation.length > 0;
  const hasCost = standardCost.trim().length > 0;

  if (rule === "consumed_average" && !hasPreparation && !hasCost) {
    return [];
  }

  const cost = counted(standardCost, true);

  if (!hasPreparation || cost === null) {
    return null;
  }

  return [{ recipeId: preparation, standardUnitCost: cost }];
}

export function PurchaseScreen() {
  const [locationId, setLocationId] = useState(ADMIN_SCOPE.venueId);
  const [orderId, setOrderId] = useState(ORDER_ID);
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
          "x-session-id": ADMIN_SCOPE.sessionId,
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
    <RecordPage
      eyebrow="Compra"
      title="Recepción"
      actions={[
        {
          label: "Registrar recepción",
          tone: "solid",
          onPress: () => {
            void receive();
          },
        },
      ]}
      status={status}
      note="La recepción se registra en la nube."
    >
      <TextField
        label="Ubicación"
        value={locationId}
        onChange={(event) => setLocationId(event.target.value)}
      />
      <TextField
        label="Orden"
        value={orderId}
        onChange={(event) => setOrderId(event.target.value)}
      />
      <TextField
        label="Insumo"
        value={ingredientId}
        onChange={(event) => setIngredientId(event.target.value)}
      />
      <TextField
        label="Cantidad"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <TextField
        label="Costo unitario"
        inputMode="numeric"
        value={unitCost}
        onChange={(event) => setUnitCost(event.target.value)}
      />
      {averages.map((cost, index) => (
        <p key={`${index}-${cost}`}>Costo promedio {cost}</p>
      ))}
    </RecordPage>
  );
}

export function ProductionScreen() {
  const [locationId, setLocationId] = useState(ADMIN_SCOPE.venueId);
  const [recipeId, setRecipeId] = useState("");
  const [expectedQuantity, setExpectedQuantity] = useState("");
  const [actualQuantity, setActualQuantity] = useState("");
  const [costRule, setCostRule] = useState("");
  const [preparationId, setPreparationId] = useState("");
  const [standardUnitCost, setStandardUnitCost] = useState("");
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
          "x-session-id": ADMIN_SCOPE.sessionId,
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

      if (shown === null) {
        setVariance(null);
        setStatus("La producción no quedó registrada.");
        return;
      }

      setVariance(shown.variance);
      setStatus("Producción registrada.");
    } catch {
      setVariance(null);
      setStatus("No se puede registrar hasta que vuelva la conexión.");
    }
  }

  async function savePolicy() {
    const rule = costRule.trim();

    if (rule !== "consumed_average" && rule !== "standard") {
      setVariance(null);
      setStatus("Revisa la regla de costo.");
      return;
    }

    const preparations = preparationsFor(rule, preparationId, standardUnitCost);

    if (preparations === null) {
      setVariance(null);
      setStatus("Revisa la regla de costo.");
      return;
    }

    try {
      const response = await fetch(POLICY_PATH, {
        method: "PUT",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-session-id": ADMIN_SCOPE.sessionId,
        },
        body: JSON.stringify({ costRule: rule, preparations }),
      });

      if (
        !response.ok ||
        !productionCostPolicy.safeParse(await response.json()).success
      ) {
        setVariance(null);
        setStatus("La política no quedó registrada.");
        return;
      }

      setVariance(null);
      setStatus("Política guardada.");
    } catch {
      setVariance(null);
      setStatus("No se puede registrar hasta que vuelva la conexión.");
    }
  }

  return (
    <RecordPage
      eyebrow="Producción"
      title="Corrida"
      actions={[
        {
          label: "Registrar producción",
          tone: "solid",
          onPress: () => {
            void record();
          },
        },
        {
          label: "Guardar política",
          tone: "ghost",
          onPress: () => {
            void savePolicy();
          },
        },
      ]}
      status={status}
      note="La producción se registra en la nube."
    >
      <TextField
        label="Ubicación"
        value={locationId}
        onChange={(event) => setLocationId(event.target.value)}
      />
      <TextField
        label="Receta"
        value={recipeId}
        onChange={(event) => setRecipeId(event.target.value)}
      />
      <TextField
        label="Cantidad esperada"
        inputMode="numeric"
        value={expectedQuantity}
        onChange={(event) => setExpectedQuantity(event.target.value)}
      />
      <TextField
        label="Cantidad real"
        inputMode="numeric"
        value={actualQuantity}
        onChange={(event) => setActualQuantity(event.target.value)}
      />
      <TextField
        label="Regla"
        value={costRule}
        onChange={(event) => setCostRule(event.target.value)}
      />
      <TextField
        label="Preparación"
        value={preparationId}
        onChange={(event) => setPreparationId(event.target.value)}
      />
      <TextField
        label="Costo estándar"
        inputMode="numeric"
        value={standardUnitCost}
        onChange={(event) => setStandardUnitCost(event.target.value)}
      />
      {variance === null ? null : <p>Variación {variance}</p>}
    </RecordPage>
  );
}

export function ConsolidatedScreen() {
  const navigate = useNavigate();
  return (
    <ConsolidatedView
      onTransfer={() => {
        void navigate({ to: "/inventory/transfers" });
      }}
    />
  );
}

type TransferPost =
  | { readonly ok: true; readonly costs: readonly number[] }
  | { readonly ok: false; readonly offline: boolean };

interface VoucherLine {
  ingredientId: string;
  quantity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function costsFrom(payload: unknown): number[] | null {
  const parsed = recordedTransfer.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.lines.flatMap((line) =>
    line.unitCost === undefined ? [] : [line.unitCost],
  );
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
        "x-session-id": ADMIN_SCOPE.sessionId,
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

export function TransferScreen({
  transferId: initialTransferId = "",
}: {
  transferId?: string;
}) {
  const [originLocationId, setOriginLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transferId, setTransferId] = useState(initialTransferId);
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
    <RecordPage
      eyebrow="Inventario"
      title="Traslados"
      actions={[
        {
          label: "Solicitar traslado",
          tone: "solid",
          onPress: () => {
            void requestTransfer();
          },
        },
        {
          label: "Despachar",
          tone: "solid",
          onPress: () => {
            void dispatchTransfer();
          },
        },
        {
          label: "Recibir por QR",
          tone: "solid",
          onPress: () => {
            void receiveTransfer();
          },
        },
      ]}
      status={status}
      note="El traslado se registra en la nube."
    >
      <TextField
        label="Origen"
        value={originLocationId}
        onChange={(event) => setOriginLocationId(event.target.value)}
      />
      <TextField
        label="Destino"
        value={destinationLocationId}
        onChange={(event) => setDestinationLocationId(event.target.value)}
      />
      <TextField
        label="Insumo"
        value={ingredientId}
        onChange={(event) => setIngredientId(event.target.value)}
      />
      <TextField
        label="Cantidad"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <TextField
        label="Traslado"
        value={transferId}
        onChange={(event) => setTransferId(event.target.value)}
      />
      <TextField
        label="Actor"
        value={actorId}
        onChange={(event) => setActorId(event.target.value)}
      />
      <TextField
        label="Dispositivo"
        value={deviceId}
        onChange={(event) => setDeviceId(event.target.value)}
      />
      <TextField
        label="QR"
        value={voucherText}
        onChange={(event) => setVoucherText(event.target.value)}
      />
      <TextField
        label="Cantidad recibida"
        inputMode="numeric"
        value={receivedQuantity}
        onChange={(event) => setReceivedQuantity(event.target.value)}
      />
      <TextField
        label="Autorizador"
        value={authorizerId}
        onChange={(event) => setAuthorizerId(event.target.value)}
      />
      {costs.map((cost, index) => (
        <p key={`${index}-${cost}`}>Costo unitario {cost}</p>
      ))}
    </RecordPage>
  );
}

export function TransfersScreen() {
  return <TransferScreen />;
}

export function TransferDetailScreen() {
  return <TransferScreen transferId="t-0112" />;
}
