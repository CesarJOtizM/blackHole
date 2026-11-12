import { useState } from "react";
import {
  listScarcity,
  orderPurchase,
  requestFromWarehouse,
  type ScarcityAlert,
  type ScarcityRoute,
  type ScarcityState,
  selectedScarcity,
  selectScarcity,
} from "#src/api/admin-api.js";
import { ScarcityInboxView } from "#src/scarcity/scarcity-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";

export function ScarcityScreen({ initial }: { initial?: ScarcityRoute }) {
  const [filter, setFilter] = useState<ScarcityState>("open");
  const [alerts, setAlerts] = useState(() => listScarcity("open"));
  const [status, setStatus] = useState("");
  const [request, setRequest] = useState<ScarcityAlert | null>(() => {
    if (!initial) {
      return null;
    }
    const selected = selectedScarcity();
    return selected.route === initial ? selected : null;
  });
  const [quantity, setQuantity] = useState(
    initial === "purchase" ? "10 kg" : "8 kg",
  );
  const [detail, setDetail] = useState(
    initial === "purchase" ? "Bodega bajo el punto de reposición" : "Chapinero",
  );

  function openRequest(alert: ScarcityAlert) {
    const next = selectScarcity(alert.id) ?? alert;
    setAlerts(listScarcity(filter));
    setRequest(next);
    setQuantity(next.route === "purchase" ? "10 kg" : "8 kg");
    setDetail(
      next.route === "purchase"
        ? "Bodega bajo el punto de reposición"
        : "Chapinero",
    );
  }

  const warehouse = request?.route === "warehouse";

  return (
    <>
      <ScarcityInboxView
        filter={filter}
        alerts={alerts}
        status={status}
        onFilter={(next) => {
          setFilter(next);
          setAlerts(listScarcity(next));
        }}
        onOpen={openRequest}
      />
      <FormDialog
        open={request !== null}
        eyebrow="Se abre desde la bandeja"
        title={
          request
            ? `${warehouse ? "Pedir" : "Comprar"} ${request.name.toLowerCase()}`
            : ""
        }
        help={
          warehouse
            ? `El bajo es el punto de Chapinero. La bodega general tiene ${request?.warehouseBalance ?? ""}.`
            : "El bajo es la bodega. La orden no cierra la alerta hasta que llegue."
        }
        submitLabel={warehouse ? `Solicitar ${quantity.trim()}` : "Crear orden"}
        fields={
          request
            ? [
                {
                  label: "Cantidad",
                  value: quantity,
                  required: true,
                  onChange: setQuantity,
                },
                warehouse
                  ? {
                      label: "Destino",
                      value: detail,
                      onChange: setDetail,
                    }
                  : {
                      label: "Motivo",
                      value: detail,
                      onChange: setDetail,
                    },
              ]
            : []
        }
        onClose={() => setRequest(null)}
        onSubmit={() => {
          if (!request) {
            return;
          }
          setStatus(
            warehouse
              ? requestFromWarehouse(request.id)
              : orderPurchase(request.id),
          );
          setAlerts(listScarcity(filter));
          setRequest(null);
        }}
      />
    </>
  );
}

export function WarehouseRequestScreen() {
  return <ScarcityScreen initial="warehouse" />;
}

export function PurchaseRequestScreen() {
  return <ScarcityScreen initial="purchase" />;
}
