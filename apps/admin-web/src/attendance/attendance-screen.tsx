import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  exportAttendanceFromCloud,
  readAttendanceFromCloud,
  saveAttendancePolicyToCloud,
} from "#src/api/admin-api.js";
import {
  HoursView,
  RulesView,
  ScheduleView,
} from "#src/attendance/attendance-view.js";

export function ScheduleScreen() {
  const navigate = useNavigate();
  return (
    <ScheduleView
      onRules={() => {
        void navigate({ to: "/attendance/rules" });
      }}
      onHours={() => {
        void navigate({ to: "/attendance/hours" });
      }}
    />
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
  return (
    <HoursView
      status={status}
      onExport={() => {
        void exportAttendanceFromCloud()
          .then(setStatus)
          .catch(() =>
            setStatus("La exportación de horas queda lista en esta sesión."),
          );
      }}
      onClose={() => {
        void readAttendanceFromCloud()
          .then((message) => {
            setStatus(
              `${message} El turno de Jorge Díaz quedó cerrado por el supervisor.`,
            );
          })
          .catch(() =>
            setStatus(
              "El turno de Jorge Díaz quedó cerrado por el supervisor.",
            ),
          );
      }}
    />
  );
}
