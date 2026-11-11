import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PeopleView, RoleView } from "#src/people/people-view.js";

export function PeopleScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  return (
    <PeopleView
      status={status}
      onImport={() =>
        setStatus(
          "La importación real reemplaza esta muestra cuando llegue el archivo.",
        )
      }
      onInvite={() =>
        setStatus("La invitación queda lista para enviarse en esta sesión.")
      }
      onOpenRole={() => {
        void navigate({ to: "/people/roles/cajero-senior" });
      }}
    />
  );
}

export function RoleScreen() {
  const [status, setStatus] = useState("");
  return (
    <RoleView
      status={status}
      onSave={() =>
        setStatus("La copia del rol quedó guardada en esta sesión.")
      }
    />
  );
}
