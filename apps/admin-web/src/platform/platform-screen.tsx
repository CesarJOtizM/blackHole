import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BagView,
  type CaseMessage,
  CaseView,
  CompaniesView,
  EmptyBagView,
  PlanView,
  SetupView,
  SupportView,
  SuspendedView,
} from "#src/platform/platform-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";

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
      onBack={() =>
        setStatus("El paso anterior es sedes y marcas. Sigues en facturación.")
      }
      onLater={() =>
        setStatus("La facturación queda para después. El alta no se pierde.")
      }
      onContinue={() =>
        setStatus("El paso de facturación quedó guardado. Sigue la carta.")
      }
    />
  );
}

const grantDefaults = {
  caseLabel: "#4821 · La caja de Usaquén no imprime",
  scope: "Solo Usaquén",
  duration: "4 horas",
  level: "Solo lectura",
};

export function SupportScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [grant, setGrant] = useState(grantDefaults);
  return (
    <>
      <SupportView
        status={status}
        onGrant={() => {
          setGrant(grantDefaults);
          setOpen(true);
        }}
        onCompanies={() => {
          void navigate({ to: "/support/companies" });
        }}
        onCase={() => {
          void navigate({ to: "/support/cases/4821" });
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre al conceder"
        title="Conceder acceso"
        help="Nadie de Blackhole entra a tus datos sin este permiso."
        submitLabel="Conceder acceso"
        fields={[
          {
            label: "Caso",
            value: grant.caseLabel,
            required: true,
            onChange: (caseLabel) =>
              setGrant((current) => ({ ...current, caseLabel })),
          },
          {
            label: "Alcance",
            value: grant.scope,
            required: true,
            onChange: (scope) => setGrant((current) => ({ ...current, scope })),
          },
          {
            label: "Duración",
            value: grant.duration,
            required: true,
            onChange: (duration) =>
              setGrant((current) => ({ ...current, duration })),
          },
          {
            label: "Nivel",
            value: grant.level,
            required: true,
            onChange: (level) => setGrant((current) => ({ ...current, level })),
          },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setStatus(
            "El acceso de soporte queda concedido por 4 horas, solo lectura, y auditado.",
          );
          setOpen(false);
        }}
      />
    </>
  );
}

export function CompaniesScreen() {
  return <CompaniesView />;
}

const openingCase: CaseMessage[] = [
  {
    who: "Marta · caja",
    text: "No sale la factura, el cliente está esperando.",
  },
  {
    who: "Daniel · soporte",
    text: "La impresora reporta sin papel. Las 2 facturas están en cola y salen al cambiar el rollo.",
  },
  { who: "Marta · caja", text: "Listo, ya salieron." },
];

export function CaseScreen() {
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState(openingCase);
  const [reply, setReply] = useState("");
  return (
    <CaseView
      status={status}
      messages={messages}
      reply={reply}
      onReply={setReply}
      onSend={() => {
        const text = reply.trim();
        if (text.length === 0) {
          return;
        }
        setMessages((current) => [
          ...current,
          { who: "Daniel · soporte", text },
        ]);
        setReply("");
      }}
      onClose={() => setStatus("El caso #4821 queda cerrado en esta sesión.")}
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
