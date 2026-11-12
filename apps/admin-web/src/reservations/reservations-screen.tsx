import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AccountsView,
  CancellationView,
  SlotsView,
} from "#src/reservations/reservations-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";

const policyDefaults = {
  depositFrom: "6 personas",
  depositAmount: "$20.000 / pers.",
  appliedToAccount: "Sí",
  freeCancel: "Más de 48 h",
  noShow: "Pierde anticipo",
  releaseTable: "A los 15 min",
};

export function SlotsScreen() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [policy, setPolicy] = useState(policyDefaults);

  return (
    <>
      <SlotsView
        status={status}
        policy={policy}
        onSave={() =>
          setStatus("La capacidad de Chapinero queda guardada en esta sesión.")
        }
        onAccounts={() => {
          void navigate({ to: "/reservations/accounts" });
        }}
        onPolicy={() => {
          setPolicy(policyDefaults);
          setOpen(true);
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre desde capacidad"
        title="Políticas de la sede"
        help="La grilla de cupos se queda atrás. Estas reglas se editan juntas."
        submitLabel="Guardar políticas"
        fields={[
          {
            label: "Anticipo desde",
            value: policy.depositFrom,
            onChange: (depositFrom) =>
              setPolicy((current) => ({ ...current, depositFrom })),
          },
          {
            label: "Valor del anticipo",
            value: policy.depositAmount,
            onChange: (depositAmount) =>
              setPolicy((current) => ({ ...current, depositAmount })),
          },
          {
            label: "Se abona a la cuenta",
            value: policy.appliedToAccount,
            onChange: (appliedToAccount) =>
              setPolicy((current) => ({ ...current, appliedToAccount })),
          },
          {
            label: "Cancelar sin costo",
            value: policy.freeCancel,
            onChange: (freeCancel) =>
              setPolicy((current) => ({ ...current, freeCancel })),
          },
          {
            label: "Si no llega",
            value: policy.noShow,
            onChange: (noShow) =>
              setPolicy((current) => ({ ...current, noShow })),
          },
          {
            label: "Se libera la mesa",
            value: policy.releaseTable,
            onChange: (releaseTable) =>
              setPolicy((current) => ({ ...current, releaseTable })),
          },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setStatus(
            "La política nueva aplica solo a reservas que se creen después.",
          );
          setOpen(false);
        }}
      />
    </>
  );
}

export function AccountsScreen() {
  const [status, setStatus] = useState("");
  return (
    <AccountsView
      status={status}
      onSave={() =>
        setStatus("Las cuentas de anticipo quedaron guardadas en esta sesión.")
      }
    />
  );
}

export function CancellationScreen() {
  const [status, setStatus] = useState("");
  return (
    <CancellationView
      status={status}
      onSave={() =>
        setStatus(
          "La política nueva aplica solo a reservas que se creen después.",
        )
      }
    />
  );
}
