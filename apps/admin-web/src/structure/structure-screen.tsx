import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { StructureSection } from "#src/structure/structure-source.js";
import {
  CompanyView,
  DevicesView,
  HybridView,
  ReturnView,
  VenueView,
} from "#src/structure/structure-view.js";

export function CompanyScreen() {
  const navigate = useNavigate();
  const [section, setSection] = useState<StructureSection>("taxpayers");
  const [status, setStatus] = useState("");

  return (
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
      onCreate={() =>
        setStatus(
          "El contribuyente queda en revisión hasta que Factus responda.",
        )
      }
      onDevices={() => {
        void navigate({ to: "/structure/devices" });
      }}
      onHybrid={() => {
        void navigate({ to: "/structure/hybrid" });
      }}
    />
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
