import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  isReportSection,
  type ReportSection,
} from "#src/reports/reports-model.js";
import { ReportsView } from "#src/reports/reports-view.js";

const reportPaths = {
  sales: "/reports/sales",
  times: "/reports/times",
  "food-cost": "/reports/food-cost",
  leakage: "/reports/leakage",
  staff: "/reports/staff",
  accountant: "/reports/accountant",
  engineering: "/reports/engineering",
  reservations: "/reports/reservations",
  control: "/reports/control",
} as const satisfies Record<ReportSection, string>;

export function ReportsScreen() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const raw = pathname.replace("/reports/", "");
  const section: ReportSection = isReportSection(raw) ? raw : "sales";
  const [status, setStatus] = useState("");

  return (
    <ReportsView
      section={section}
      status={status}
      onSection={(next) => {
        void navigate({ to: reportPaths[next] });
      }}
      onExport={() => setStatus("El reporte queda exportado en esta sesión.")}
    />
  );
}
