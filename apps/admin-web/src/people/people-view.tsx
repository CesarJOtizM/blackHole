import { useState } from "react";
import {
  type Cell,
  RecordPage,
  type RecordTab,
} from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

type PeopleTab = "all" | "salon" | "kitchen" | "cash" | "admin" | "revoked";

const people = [
  [
    "Carolina Méndez",
    "Propietaria",
    "Todas",
    "Correo + 2FA",
    "Ahora",
    "Activa",
    "admin",
  ],
  [
    "Sofía León",
    "Supervisora de turno",
    "Chapinero",
    "PIN",
    "14:20",
    "En turno",
    "salon",
  ],
  ["Marta Ruiz", "Cajera", "Chapinero", "PIN", "14:20", "En turno", "cash"],
  [
    "Luis Pérez",
    "Mesero",
    "Chapinero · Usaquén",
    "PIN",
    "14:18",
    "En turno",
    "salon",
  ],
  [
    "Andrés Pinto",
    "Domiciliario",
    "Chapinero",
    "PIN",
    "13:55",
    "Activo",
    "salon",
  ],
  [
    "Diana Rojas",
    "Contadora",
    "Todas · solo lectura",
    "Correo + 2FA",
    "Ayer",
    "Activa",
    "admin",
  ],
  [
    "Camilo Ruiz",
    "Mesero",
    "Chapinero",
    "PIN",
    "12 oct",
    "Revocado",
    "revoked",
  ],
] as const;

const permissions = [
  ["Cobrar y emitir factura", "Sí", "—", "—"],
  ["Aplicar descuento", "Sí", "15%", "PIN supervisor"],
  ["Anular ítem antes de cocina", "Sí", "—", "—"],
  ["Anular ítem después de cocina", "No", "—", "PIN supervisor"],
  ["Registrar egreso de caja", "Sí", "$50.000", "PIN supervisor"],
  ["Abrir cajón sin venta", "Sí", "2 por turno", "Auditado"],
  ["Reabrir cuenta cobrada", "No", "—", "Admin de sede"],
  ["Ver esperado antes del arqueo", "No", "—", "Nunca"],
] as const;

export function PeopleView({
  status,
  onInvite,
  onImport,
  onOpenRole,
}: {
  status?: string;
  onInvite: () => void;
  onImport: () => void;
  onOpenRole: () => void;
}) {
  const [tab, setTab] = useState<PeopleTab>("all");
  const visible = people.filter((person) => {
    if (tab === "all") return person[5] !== "Revocado";
    if (tab === "revoked") return person[5] === "Revocado";
    return person[6] === tab;
  });
  const rows: Cell[][] = visible.map((person) => [
    person[0],
    person[1],
    person[2],
    person[3],
    person[4],
    {
      chip: person[5],
      tone: person[5] === "Revocado" ? "stamp" : "go",
    },
  ]);

  return (
    <RecordPage
      eyebrow="38 personas · 4 sedes"
      title="Usuarios"
      actions={[
        { label: "Importar Excel", tone: "ghost", onPress: onImport },
        { label: "Invitar persona", tone: "solid", onPress: onInvite },
      ]}
      tabs={peopleTabs(tab, setTab)}
      columns={[
        "Persona",
        "Rol",
        "Sedes",
        "Ingreso",
        "Última actividad",
        "Estado",
      ]}
      rows={rows}
      caption="Usuarios"
      status={status}
    >
      <button type="button" className={ui.textButton} onClick={onOpenRole}>
        Ver rol Cajero senior
      </button>
    </RecordPage>
  );
}

export function RoleView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Copia de cajero · 4 personas"
      title="Rol: Cajero senior"
      actions={[{ label: "Guardar rol", tone: "solid", onPress: onSave }]}
      columns={["Acción", "Puede", "Tope", "Si excede"]}
      rows={permissions.map((row) => [...row])}
      caption="Permisos del rol"
      note="Los roles predefinidos no se editan; se copian. Nadie puede dar a un rol más permisos de los que tiene."
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Alcance</h2>
          <p className={record.fact}>
            <span>Basado en</span>
            <strong>Cajero (predefinido)</strong>
          </p>
          {["Chapinero", "Usaquén"].map((venue) => (
            <p key={venue} className={record.fact}>
              <span>{venue}</span>
              <strong>Sí</strong>
            </p>
          ))}
          {["Cedritos", "Salitre"].map((venue) => (
            <p key={venue} className={record.fact}>
              <span>{venue}</span>
              <strong>No</strong>
            </p>
          ))}
        </>
      }
    />
  );
}

function peopleTabs(
  tab: PeopleTab,
  onTab: (tab: PeopleTab) => void,
): RecordTab[] {
  const items: Array<[PeopleTab, string]> = [
    ["all", "Todas"],
    ["salon", "Salón"],
    ["kitchen", "Cocina"],
    ["cash", "Caja"],
    ["admin", "Administración"],
    ["revoked", "Revocadas"],
  ];
  return items.map(([id, label]) => ({
    id,
    label,
    active: tab === id,
    onSelect: () => onTab(id),
  }));
}
