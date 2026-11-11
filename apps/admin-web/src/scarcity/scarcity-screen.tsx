import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  listScarcity,
  orderPurchase,
  requestFromWarehouse,
  type ScarcityState,
  selectedScarcity,
  selectScarcity,
} from "#src/api/admin-api.js";
import {
  PurchaseRequestView,
  ScarcityInboxView,
  WarehouseRequestView,
} from "#src/scarcity/scarcity-view.js";

export function ScarcityScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ScarcityState>("open");
  const [alerts, setAlerts] = useState(() => listScarcity("open"));

  return (
    <ScarcityInboxView
      filter={filter}
      alerts={alerts}
      onFilter={(next) => {
        setFilter(next);
        setAlerts(listScarcity(next));
      }}
      onOpen={(alert) => {
        selectScarcity(alert.id);
        void navigate({
          to:
            alert.route === "warehouse"
              ? "/inventory/scarcity/warehouse"
              : "/inventory/scarcity/purchase",
        });
      }}
    />
  );
}

export function WarehouseRequestScreen() {
  const [alert, setAlert] = useState(() => selectedScarcity());
  const [status, setStatus] = useState("");

  return (
    <WarehouseRequestView
      alert={alert}
      status={status}
      onRequest={() => {
        setStatus(requestFromWarehouse(alert.id));
        setAlert(selectedScarcity());
      }}
    />
  );
}

export function PurchaseRequestScreen() {
  const [alert, setAlert] = useState(() => selectedScarcity());
  const [status, setStatus] = useState("");

  return (
    <PurchaseRequestView
      alert={alert}
      status={status}
      onOrder={() => {
        setStatus(orderPurchase(alert.id));
        setAlert(selectedScarcity());
      }}
    />
  );
}
