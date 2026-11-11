import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BalanceView,
  DocumentsView,
  TaxProfileView,
} from "#src/fiscal/fiscal-view.js";

export function TaxProfileScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  return (
    <TaxProfileView
      status={status}
      onCreate={() =>
        setStatus(
          "La resolución nueva queda en borrador hasta el número de la DIAN.",
        )
      }
      onDocuments={() => {
        void navigate({ to: "/fiscal/documents" });
      }}
      onBalance={() => {
        void navigate({ to: "/fiscal/balance" });
      }}
    />
  );
}

export function DocumentsScreen() {
  const [nit, setNit] = useState("900.456.123-4");
  const [status, setStatus] = useState("");
  return (
    <DocumentsView
      nit={nit}
      status={status}
      onNit={setNit}
      onResend={() =>
        setStatus(
          `FECH-41380 se reenvía con el NIT ${nit}. El cobro ya estaba pagado.`,
        )
      }
      onConsumer={() =>
        setStatus(
          "FECH-41380 pasa a consumidor final. Se puede refacturar hasta el 30 nov.",
        )
      }
    />
  );
}

export function BalanceScreen() {
  const [status, setStatus] = useState("");
  return (
    <BalanceView
      status={status}
      onBuy={() =>
        setStatus(
          "El paquete de 50.000 documentos queda pedido en esta sesión.",
        )
      }
    />
  );
}
