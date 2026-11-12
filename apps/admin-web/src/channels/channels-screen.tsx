import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChannelsView,
  MappingView,
  ReconciliationView,
} from "#src/channels/channels-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";

export function ChannelsScreen() {
  const navigate = useNavigate();
  const [autoAccept, setAutoAccept] = useState(true);
  const [pauseKitchen, setPauseKitchen] = useState(true);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [channel, setChannel] = useState("Rappi");
  const [commission, setCommission] = useState("18%");
  const [priceRule, setPriceRule] = useState("Mismo precio de salón");
  const [venue, setVenue] = useState("Todas");
  return (
    <>
      <ChannelsView
        autoAccept={autoAccept}
        pauseKitchen={pauseKitchen}
        onAutoAccept={setAutoAccept}
        onPauseKitchen={setPauseKitchen}
        onConnect={() => {
          setChannel("Rappi");
          setCommission("18%");
          setPriceRule("Mismo precio de salón");
          setVenue("Todas");
          setOpen(true);
        }}
        onOpenMapping={() => {
          void navigate({ to: "/deliveries/mapping" });
        }}
        onOpenReconciliation={() => {
          void navigate({ to: "/deliveries/reconciliation" });
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre desde canales"
        title="Conectar canal"
        help="El menú y los precios de esta marca se publican en el canal. La sede no lo ve hasta que el canal responde."
        submitLabel="Conectar canal"
        fields={[
          {
            label: "Canal",
            value: channel,
            required: true,
            onChange: setChannel,
          },
          {
            label: "Comisión",
            value: commission,
            required: true,
            onChange: setCommission,
          },
          {
            label: "Regla de precio",
            value: priceRule,
            required: true,
            onChange: setPriceRule,
          },
          { label: "Sede", value: venue, onChange: setVenue },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setNotice("El canal nuevo queda en pausa hasta publicar la carta.");
          setOpen(false);
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
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
