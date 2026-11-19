import type { ReportFamily } from "@blackhole/contracts";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  readControlReportFromCloud,
  readUnusualBehaviorFromCloud,
} from "#src/api/admin-api.js";
import {
  isReportSection,
  type ReportModel,
  type ReportSection,
} from "#src/reports/reports-model.js";
import {
  bogotaToday,
  type InventoryReportReader,
  isSiteFamily,
  presentFoodCost,
  type ReportSnapshot,
  readInventoryReports,
  readSiteReport,
  type SiteReportReader,
} from "#src/reports/reports-source.js";
import { ReportsView } from "#src/reports/reports-view.js";

const clock = () => Date.now();

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

const isEmpty = (snapshot: ReportSnapshot): boolean => {
  if (snapshot.family === "sales") {
    return (
      snapshot.report.grossCop === null &&
      snapshot.report.netCop === null &&
      snapshot.report.ticketCount === null
    );
  }
  return snapshot.report.empty;
};

const salesFigure = (snapshot: ReportSnapshot): string | null => {
  if (snapshot.family !== "sales" || snapshot.report.grossCop === null) {
    return null;
  }
  return String(snapshot.report.grossCop);
};

export function SiteReportPanel({
  family,
  now,
  readReport,
}: {
  family: ReportFamily;
  now: () => number;
  readReport: SiteReportReader;
}) {
  const [draftFrom, setDraftFrom] = useState(() => bogotaToday(now()).from);
  const [draftTo, setDraftTo] = useState(() => bogotaToday(now()).to);
  const [period, setPeriod] = useState(() => bogotaToday(now()));
  const [scope, setScope] = useState<"today" | "history">("today");
  const [phase, setPhase] = useState<
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "ready"; snapshot: ReportSnapshot }
  >({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void readReport({ family, from: period.from, to: period.to })
      .then((snapshot) => {
        if (active) {
          setPhase({ kind: "ready", snapshot });
        }
      })
      .catch(() => {
        if (active) {
          setPhase({ kind: "failed" });
        }
      });
    return () => {
      active = false;
    };
  }, [family, period.from, period.to, readReport]);

  const snapshot = phase.kind === "ready" ? phase.snapshot : null;
  const empty = snapshot !== null && isEmpty(snapshot);
  const figure = snapshot !== null && !empty ? salesFigure(snapshot) : null;

  return (
    <section>
      <p>{scope === "today" ? "Hoy en Bogotá" : "Historial"}</p>
      {phase.kind === "failed" ? <p>No se pudo leer</p> : null}
      {empty ? <p>Sin datos</p> : null}
      {figure !== null ? <p>{figure}</p> : null}
      <label>
        Desde
        <input
          value={draftFrom}
          onChange={(event) => setDraftFrom(event.target.value)}
        />
      </label>
      <label>
        Hasta
        <input
          value={draftTo}
          onChange={(event) => setDraftTo(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          setScope("history");
          setPeriod({ from: draftFrom, to: draftTo });
        }}
      >
        Ver historial
      </button>
    </section>
  );
}

const phaseStatus = {
  loading: "Cargando",
  failed: "No se pudo leer",
  pending: "Pendiente",
  ready: "",
} as const;

export function FoodCostReportPanel({
  now,
  readReports,
  onSection,
}: {
  now: () => number;
  readReports: InventoryReportReader;
  onSection: (section: ReportSection) => void;
}) {
  const [period] = useState(() => bogotaToday(now()));
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState<
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "pending"; model: ReportModel }
    | { kind: "ready"; model: ReportModel }
  >({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void readReports(period)
      .then((payload) => {
        if (!active) {
          return;
        }
        setPhase(presentFoodCost(payload));
      })
      .catch(() => {
        if (active) {
          setPhase({ kind: "failed" });
        }
      });
    return () => {
      active = false;
    };
  }, [period, readReports]);

  const model =
    phase.kind === "ready" || phase.kind === "pending"
      ? phase.model
      : undefined;
  const status =
    phase.kind === "ready" && notice.length > 0
      ? notice
      : phaseStatus[phase.kind];

  return (
    <ReportsView
      section="food-cost"
      status={status}
      model={model}
      onSection={onSection}
      onExport={() => {
        setNotice("El reporte queda exportado en esta sesión.");
      }}
    />
  );
}

export function ReportsScreen() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const raw = pathname.replace("/reports/", "");
  const [status, setStatus] = useState("");

  if (isSiteFamily(raw)) {
    return (
      <SiteReportPanel family={raw} now={clock} readReport={readSiteReport} />
    );
  }

  if (raw === "food-cost") {
    return (
      <FoodCostReportPanel
        now={clock}
        readReports={readInventoryReports}
        onSection={(next) => {
          void navigate({ to: reportPaths[next] });
        }}
      />
    );
  }

  const section: ReportSection = isReportSection(raw) ? raw : "sales";

  return (
    <ReportsView
      section={section}
      status={status}
      onSection={(next) => {
        void navigate({ to: reportPaths[next] });
      }}
      onExport={() => {
        const sample = "El reporte queda exportado en esta sesión.";
        const request =
          section === "control"
            ? readControlReportFromCloud()
            : section === "leakage"
              ? readUnusualBehaviorFromCloud()
              : Promise.resolve(sample);

        void request
          .then((message) => setStatus(message))
          .catch(() => setStatus(sample));
      }}
    />
  );
}
