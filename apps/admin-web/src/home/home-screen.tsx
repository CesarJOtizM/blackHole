import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { attention } from "#src/home/home-source.js";
import { HomeView } from "#src/home/home-view.js";

export function HomeScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  return (
    <HomeView
      status={status}
      onExport={() => setStatus("El export de hoy queda listo en esta sesión.")}
      onOpen={(path: (typeof attention)[number]["to"]) => {
        void navigate({ to: path });
      }}
    />
  );
}
