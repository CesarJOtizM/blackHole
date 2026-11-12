import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { attention } from "#src/home/home-source.js";
import { HomeView } from "#src/home/home-view.js";
import { NoticeToast } from "#src/shell/notice-toast.js";

export function HomeScreen() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");

  return (
    <>
      <HomeView
        onExport={() =>
          setNotice("El export de hoy queda listo en esta sesión.")
        }
        onOpen={(path: (typeof attention)[number]["to"]) => {
          void navigate({ to: path });
        }}
      />
      <NoticeToast message={notice} onClose={() => setNotice("")} />
    </>
  );
}
