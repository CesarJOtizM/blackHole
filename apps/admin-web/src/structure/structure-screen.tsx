import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormDialog } from "#src/shell/form-dialog.js";
import type { StructureSection } from "#src/structure/structure-source.js";
import {
  CompanyView,
  DevicesView,
  HybridView,
  ReturnView,
  VenueView,
} from "#src/structure/structure-view.js";

const taxpayerDefaults = {
  name: "Parrilla Norte SAS",
  nit: "901.556.778-1",
  regime: "Responsable de IVA",
  tax: "INC 8%",
};

const brandDefaults = {
  name: "Burger Ember",
  description: "Marca virtual de hamburguesas",
  venues: "Salitre, solo domicilios",
};

export function CompanyScreen() {
  const navigate = useNavigate();
  const [section, setSection] = useState<StructureSection>("taxpayers");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<"taxpayer" | "brand" | null>(null);
  const [taxpayer, setTaxpayer] = useState(taxpayerDefaults);
  const [brand, setBrand] = useState(brandDefaults);

  return (
    <>
      <CompanyView
        section={section}
        status={status}
        onSection={(next) => {
          if (next === "venues") {
            void navigate({ to: "/structure/chapinero" });
            return;
          }
          setSection(next);
        }}
        onCreateTaxpayer={() => {
          setTaxpayer(taxpayerDefaults);
          setDialog("taxpayer");
        }}
        onCreateBrand={() => {
          setBrand(brandDefaults);
          setDialog("brand");
        }}
        onDevices={() => {
          void navigate({ to: "/structure/devices" });
        }}
        onHybrid={() => {
          void navigate({ to: "/structure/hybrid" });
        }}
      />
      <FormDialog
        open={dialog === "taxpayer"}
        eyebrow="Se abre desde el listado"
        title="Nuevo contribuyente"
        help="La sede sigue operando. Este NIT factura cuando Factus lo active."
        submitLabel="Crear contribuyente"
        fields={[
          {
            label: "Razón social",
            value: taxpayer.name,
            required: true,
            onChange: (name) =>
              setTaxpayer((current) => ({ ...current, name })),
          },
          {
            label: "NIT",
            value: taxpayer.nit,
            required: true,
            onChange: (nit) => setTaxpayer((current) => ({ ...current, nit })),
          },
          {
            label: "Régimen",
            value: taxpayer.regime,
            required: true,
            onChange: (regime) =>
              setTaxpayer((current) => ({ ...current, regime })),
          },
          {
            label: "Impuesto al consumo",
            value: taxpayer.tax,
            onChange: (tax) => setTaxpayer((current) => ({ ...current, tax })),
          },
        ]}
        onClose={() => setDialog(null)}
        onSubmit={() => {
          setStatus(
            "El contribuyente queda en revisión hasta que Factus responda.",
          );
          setDialog(null);
        }}
      />
      <FormDialog
        open={dialog === "brand"}
        eyebrow="Se abre desde el listado"
        title="Nueva marca"
        help="La marca no vende hasta que indiques en qué sedes aparece."
        submitLabel="Crear marca"
        fields={[
          {
            label: "Nombre",
            value: brand.name,
            required: true,
            onChange: (name) => setBrand((current) => ({ ...current, name })),
          },
          {
            label: "Descripción",
            value: brand.description,
            onChange: (description) =>
              setBrand((current) => ({ ...current, description })),
          },
          {
            label: "Se vende en",
            value: brand.venues,
            required: true,
            onChange: (venues) =>
              setBrand((current) => ({ ...current, venues })),
          },
        ]}
        onClose={() => setDialog(null)}
        onSubmit={() => {
          setStatus("La marca queda creada. Todavía no vende en ninguna sede.");
          setDialog(null);
        }}
      />
    </>
  );
}

export function VenueScreen() {
  const [status, setStatus] = useState("");
  return (
    <VenueView
      status={status}
      onSave={() => setStatus("Chapinero quedó guardado en esta sesión.")}
    />
  );
}

export function DevicesScreen() {
  const [status, setStatus] = useState("");
  return (
    <DevicesView
      status={status}
      onGenerate={() =>
        setStatus("El código K7Q-4MZ sigue vigente 9 minutos y 42 segundos.")
      }
    />
  );
}

export function HybridScreen() {
  const navigate = useNavigate();
  return (
    <HybridView
      onReturn={() => {
        void navigate({ to: "/structure/return" });
      }}
    />
  );
}

export function ReturnScreen() {
  const navigate = useNavigate();
  const [accept, setAccept] = useState(false);
  const [reason, setReason] = useState(
    "Corte del proveedor, se concilia en el dueño",
  );
  const [status, setStatus] = useState("");

  return (
    <ReturnView
      accept={accept}
      reason={reason}
      status={status}
      onAccept={setAccept}
      onReason={setReason}
      onCancel={() => {
        void navigate({ to: "/structure/hybrid" });
      }}
      onConfirm={() => {
        if (!accept || reason.trim().length === 0) {
          setStatus(
            "Acepta lo que no sube y escribe el motivo. Queda auditado.",
          );
          return;
        }
        setStatus("La vuelta a nube quedó aceptada y auditada en esta sesión.");
      }}
    />
  );
}
