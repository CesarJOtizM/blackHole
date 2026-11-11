import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
      onSave={() => setStatus("Las reglas quedaron guardadas en esta sesión.")}
    />
  );
}

export function HoursScreen() {
  const [status, setStatus] = useState("");
  return (
    <HoursView
      status={status}
      onClose={() =>
        setStatus("El turno de Jorge Díaz quedó cerrado por el supervisor.")
      }
    />
  );
}
