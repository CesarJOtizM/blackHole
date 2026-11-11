import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AccountsView,
  CancellationView,
  SlotsView,
} from "#src/reservations/reservations-view.js";

export function SlotsScreen() {
  const navigate = useNavigate();
  return (
    <SlotsView
      onAccounts={() => {
        void navigate({ to: "/reservations/accounts" });
      }}
      onPolicy={() => {
        void navigate({ to: "/reservations/cancellation" });
      }}
    />
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
