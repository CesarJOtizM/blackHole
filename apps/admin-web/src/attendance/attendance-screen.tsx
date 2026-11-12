import { useState } from "react";
import {
  exportAttendanceFromCloud,
  saveAttendancePolicyToCloud,
} from "#src/api/admin-api.js";
import {
  HoursView,
  openingRoster,
  RulesView,
  type ScheduledPerson,
  ScheduleView,
} from "#src/attendance/attendance-view.js";
import { FormDialog } from "#src/shell/form-dialog.js";
import { NoticeToast } from "#src/shell/notice-toast.js";

const weekDays = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

const shiftHours = (shift: string): [string, string] => {
  const match = /^(\d{1,2})–(\d{1,2})$/.exec(shift);
  return match ? [match[1] ?? "", match[2] ?? ""] : ["", ""];
};

export function ScheduleScreen() {
  const [notice, setNotice] = useState("");
  const [people, setPeople] = useState<ScheduledPerson[]>(openingRoster);
  const [edit, setEdit] = useState<{ name: string; dayIndex: number } | null>(
    null,
  );
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const openShift = (name: string, dayIndex: number) => {
    const person = people.find((item) => item.name === name);
    const [start, end] = shiftHours(person?.shifts[dayIndex] ?? "Libre");
    setStartsAt(start);
    setEndsAt(end);
    setEdit({ name, dayIndex });
  };

  const saveShift = () => {
    if (!edit) {
      return;
    }

    const start = startsAt.trim();
    const end = endsAt.trim();
    const next =
      start.length > 0 && end.length > 0 ? `${start}–${end}` : "Libre";
    setPeople((current) =>
      current.map((person) =>
        person.name === edit.name
          ? {
              ...person,
              shifts: person.shifts.map((shift, index) =>
                index === edit.dayIndex ? next : shift,
              ),
            }
          : person,
      ),
    );
    setNotice(
      `El turno de ${edit.name} el ${weekDays[edit.dayIndex]} queda en ${next}.`,
    );
    setEdit(null);
  };

  return (
    <>
      <ScheduleView
        people={people}
        onCopy={() => {
          setNotice("La semana anterior queda copiada en esta sesión.");
        }}
        onPublish={() => {
          setNotice("La semana queda publicada en esta sesión.");
        }}
        onShift={openShift}
      />
      <FormDialog
        open={edit !== null}
        eyebrow={edit ? weekDays[edit.dayIndex] : ""}
        title={edit?.name ?? "Turno"}
        help="Escribe la hora de entrada y la de salida. Si el día queda libre, borra las dos."
        submitLabel="Guardar turno"
        fields={[
          { label: "Entrada", value: startsAt, onChange: setStartsAt },
          { label: "Salida", value: endsAt, onChange: setEndsAt },
        ]}
        onClose={() => setEdit(null)}
        onSubmit={saveShift}
      />
      <NoticeToast
        message={notice}
        onClose={() => {
          setNotice("");
        }}
      />
    </>
  );
}

export function RulesScreen() {
  const [status, setStatus] = useState("");
  return (
    <RulesView
      status={status}
      onSave={() => {
        void saveAttendancePolicyToCloud()
          .then(setStatus)
          .catch(() =>
            setStatus(
              "Las reglas quedaron guardadas en esta sesión. La nube no las recibió.",
            ),
          );
      }}
    />
  );
}

export function HoursScreen() {
  const [status, setStatus] = useState("");
  const [exitAt, setExitAt] = useState("23:05");
  const [reason, setReason] = useState("Olvidó marcar · confirmado por Sofía");
  return (
    <HoursView
      status={status}
      exitAt={exitAt}
      reason={reason}
      onExitAt={setExitAt}
      onReason={setReason}
      onExport={() => {
        void exportAttendanceFromCloud()
          .then(setStatus)
          .catch(() =>
            setStatus("La exportación de horas queda lista en esta sesión."),
          );
      }}
      onCorrect={() => {
        setStatus(
          `La salida de Jorge Díaz queda en ${exitAt.trim()}. La marca original sigue en la auditoría.`,
        );
      }}
    />
  );
}
