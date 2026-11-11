import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BagView,
  CaseView,
  CompaniesView,
  EmptyBagView,
  PlanView,
  SetupView,
  SupportView,
  SuspendedView,
} from "#src/platform/platform-view.js";

export function PlanScreen() {
  const navigate = useNavigate();
  return (
    <PlanView
      onSetup={() => {
        void navigate({ to: "/plan/setup" });
      }}
      onSupport={() => {
        void navigate({ to: "/plan/support" });
      }}
      onBag={() => {
        void navigate({ to: "/plan/bag" });
      }}
      onFactus={() => {
        void navigate({ to: "/plan/factus" });
      }}
    />
  );
}

export function SetupScreen() {
  const [status, setStatus] = useState("");
  return (
    <SetupView
      status={status}
      onContinue={() =>
        setStatus("El paso de facturación quedó guardado. Sigue la resolución.")
      }
    />
  );
}

export function SupportScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  return (
    <SupportView
      status={status}
      onGrant={() =>
        setStatus(
          "El acceso de soporte queda concedido por 2 horas y auditado.",
        )
      }
      onCompanies={() => {
        void navigate({ to: "/support/companies" });
      }}
      onCase={() => {
        void navigate({ to: "/support/cases/4821" });
      }}
    />
  );
}

export function CompaniesScreen() {
  return <CompaniesView />;
}

export function CaseScreen() {
  const [status, setStatus] = useState("");
  return (
    <CaseView
      status={status}
      onNote={() =>
        setStatus(
          "La nota quedó en el caso: sin papel en la EPSON de parrilla.",
        )
      }
    />
  );
}

export function BagScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  return (
    <BagView
      status={status}
      onBuy={() =>
        setStatus(
          "El paquete de 50.000 documentos queda pedido en esta sesión.",
        )
      }
      onEmpty={() => {
        void navigate({ to: "/plan/bag/empty" });
      }}
      onSuspended={() => {
        void navigate({ to: "/plan/suspended" });
      }}
    />
  );
}

export function EmptyBagScreen() {
  return <EmptyBagView />;
}

export function SuspendedScreen() {
  return <SuspendedView />;
}
