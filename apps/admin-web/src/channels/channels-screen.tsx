import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChannelsView,
  MappingView,
  ReconciliationView,
} from "#src/channels/channels-view.js";

export function ChannelsScreen() {
  const navigate = useNavigate();
  const [autoAccept, setAutoAccept] = useState(true);
  const [pauseKitchen, setPauseKitchen] = useState(true);
  const [status, setStatus] = useState("");
  return (
    <ChannelsView
      autoAccept={autoAccept}
      pauseKitchen={pauseKitchen}
      status={status}
      onAutoAccept={setAutoAccept}
      onPauseKitchen={setPauseKitchen}
      onConnect={() =>
        setStatus("El canal nuevo queda en pausa hasta publicar la carta.")
      }
      onOpenMapping={() => {
        void navigate({ to: "/deliveries/mapping" });
      }}
      onOpenReconciliation={() => {
        void navigate({ to: "/deliveries/reconciliation" });
      }}
    />
  );
}

export function MappingScreen() {
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  return (
    <MappingView
      assigned={assigned}
      status={status}
      onAssign={(externalName, ownName) =>
        setAssigned((current) => ({ ...current, [externalName]: ownName }))
      }
      onPublish={() =>
        setStatus("La carta de Rappi queda publicada en esta sesión.")
      }
    />
  );
}

export function ReconciliationScreen() {
  const [claimed, setClaimed] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  return (
    <ReconciliationView
      claimed={claimed}
      status={status}
      onClaim={(id) => {
        setClaimed((current) => [...current, id]);
        setStatus(`${id} quedó reclamado en esta sesión.`);
      }}
      onUpload={() => setStatus("La liquidación queda cargada en esta sesión.")}
      onExport={() => setStatus("El export de la conciliación queda listo.")}
    />
  );
}
