import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PeopleView, RoleView } from "#src/people/people-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";

export function PeopleScreen() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Laura Ortiz");
  const [email, setEmail] = useState("laura@laparrilla.co");
  const [role, setRole] = useState("Cajero");
  const [venues, setVenues] = useState("Chapinero, Usaquén");
  return (
    <>
      <PeopleView
        onImportFile={(file) =>
          setNotice(`El archivo ${file.name} queda listo en esta sesión.`)
        }
        onInvite={() => {
          setName("Laura Ortiz");
          setEmail("laura@laparrilla.co");
          setRole("Cajero");
          setVenues("Chapinero, Usaquén");
          setOpen(true);
        }}
        onOpenRole={() => {
          void navigate({ to: "/people/roles/cajero-senior" });
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre desde usuarios"
        title="Invitar persona"
        help="Le llega un correo para entrar. El rol limita lo que puede hacer en las sedes."
        submitLabel="Enviar invitación"
        fields={[
          { label: "Nombre", value: name, required: true, onChange: setName },
          {
            label: "Correo",
            value: email,
            required: true,
            onChange: setEmail,
          },
          { label: "Rol", value: role, required: true, onChange: setRole },
          { label: "Sedes", value: venues, onChange: setVenues },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setNotice("La invitación queda lista para enviarse en esta sesión.");
          setOpen(false);
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
  );
}

export function RoleScreen() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [basedOn, setBasedOn] = useState("Cajero (predefinido)");
  const [venues, setVenues] = useState("Chapinero, Usaquén, Cedritos");
  return (
    <>
      <RoleView
        status={status}
        onSave={() =>
          setStatus("La copia del rol quedó guardada en esta sesión.")
        }
        onEditScope={() => {
          setBasedOn("Cajero (predefinido)");
          setVenues("Chapinero, Usaquén, Cedritos");
          setOpen(true);
        }}
      />
      <FormDialog
        open={open}
        eyebrow="Se abre desde el rol"
        title="Alcance de cajero"
        help="El rol se copia del predefinido. Nadie da más permisos de los que tiene."
        submitLabel="Guardar alcance"
        fields={[
          { label: "Basado en", value: basedOn, onChange: setBasedOn },
          {
            label: "Sedes",
            value: venues,
            required: true,
            onChange: setVenues,
          },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setStatus("El alcance del rol quedó guardado en esta sesión.");
          setOpen(false);
        }}
      />
    </>
  );
}
