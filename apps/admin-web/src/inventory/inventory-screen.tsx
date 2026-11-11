import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ConsolidatedView,
  PurchaseView,
  RecipeView,
  SuppliesView,
  TransferDetailView,
  TransfersView,
} from "#src/inventory/inventory-view.js";

export function SuppliesScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<
    "all" | "low" | "meat" | "dairy" | "drinks" | "packaging"
  >("all");
  const [status, setStatus] = useState("");
  return (
    <SuppliesView
      tab={tab}
      status={status}
      onTab={setTab}
      onImport={() => setStatus("La importación de insumos espera el archivo.")}
      onCreate={() => setStatus("El insumo nuevo queda en borrador.")}
      onOrder={() =>
        setStatus(
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

export function PurchaseScreen() {
  const [status, setStatus] = useState("");
  return (
    <PurchaseView
      status={status}
      onSend={() =>
        setStatus("La orden queda lista para WhatsApp del proveedor.")
      }
      onReceive={() =>
        setStatus(
          "Recepción confirmada. Suben existencias y el costo promedio.",
        )
      }
    />
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

export function TransfersScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  return (
    <TransfersView
      status={status}
      onCreate={() => setStatus("El traslado nuevo sale de la bodega general.")}
      onOpen={() => {
        void navigate({ to: "/inventory/transfers/t-0112" });
      }}
    />
  );
}

export function TransferDetailScreen() {
  const [status, setStatus] = useState("");
  return (
    <TransferDetailView
      status={status}
      onPrint={() =>
        setStatus(
          "El comprobante sale por el puente cuando la impresora esté conectada.",
        )
      }
    />
  );
}
