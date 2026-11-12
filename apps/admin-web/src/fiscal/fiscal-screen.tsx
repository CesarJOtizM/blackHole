import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BalanceView,
  DocumentsView,
  TaxProfileView,
} from "#src/fiscal/fiscal-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";

export function TaxProfileScreen() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [prefix, setPrefix] = useState("SETT");
  const [kind, setKind] = useState("Factura electrónica");
  const [from, setFrom] = useState("1");
  const [until, setUntil] = useState("5.000");
  return (
    <>
      <TaxProfileView
        onCreate={() => {
          setPrefix("SETT");
          setKind("Factura electrónica");
          setFrom("1");
          setUntil("5.000");
          setOpen(true);
        }}
        onDocuments={() => {
          void navigate({ to: "/fiscal/documents" });
        }}
        onBalance={() => {
          void navigate({ to: "/fiscal/balance" });
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre desde el perfil"
        title="Nueva resolución"
        help="Factus numera con este rango. La sede no factura con él hasta que quede vigente."
        submitLabel="Guardar resolución"
        fields={[
          {
            label: "Prefijo",
            value: prefix,
            required: true,
            onChange: setPrefix,
          },
          { label: "Tipo", value: kind, required: true, onChange: setKind },
          { label: "Desde", value: from, required: true, onChange: setFrom },
          { label: "Hasta", value: until, onChange: setUntil },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setNotice(
            "La resolución nueva queda en borrador hasta el número de la DIAN.",
          );
          setOpen(false);
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
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
