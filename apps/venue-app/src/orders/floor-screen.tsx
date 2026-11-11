import { useState } from "react";
import { Button, StatusChip, type ChipTone } from "@blackhole/ui";
import {
  tableTotal,
  useService,
  type TableState,
} from "#src/service/service-session.js";

const SUPERVISOR_PIN = "2468";

const stateLabel: Record<TableState, string> = {
  free: "Libre",
  occupied: "Ocupada",
  check: "Precuenta",
  clean: "Por limpiar",
};

const stateTone: Record<TableState, ChipTone> = {
  free: "free",
  occupied: "occupied",
  check: "check-requested",
  clean: "to-clean",
};

const tableClass: Record<TableState, string> = {
  free: "border-border bg-table-free text-ink",
  occupied: "border-table-occupied bg-table-occupied text-on-strong",
  check: "border-table-check bg-table-check text-ink",
  clean: "border-table-clean bg-table-clean text-on-strong",
};

function cop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function FloorScreen() {
  const service = useService();
  const [selectedId, setSelectedId] = useState("01");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const selected = service.tables.find((table) => table.id === selectedId);

  function authorizeVoid(lineId: string) {
    if (pin !== SUPERVISOR_PIN) {
      setPinError("PIN de supervisor incorrecto.");
      return;
    }
    if (selected === undefined) return;
    service.voidLine(selected.id, lineId);
    setPin("");
    setPinError("");
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Chapinero · Jorge Díaz
        </p>
        <h1 className="font-display text-title">Salón</h1>
        <p className="text-ink-muted">
          {service.clockedIn
            ? "Entrada marcada a las 12:00."
            : "Sin entrada no se toman pedidos."}
        </p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {service.tables.map((table) => (
          <button
            key={table.id}
            type="button"
            aria-pressed={table.id === selectedId}
            onClick={() => setSelectedId(table.id)}
            className={`grid min-h-24 place-items-center rounded-full border-2 ${tableClass[table.state]} ${table.id === selectedId ? "outline-4 outline-offset-2 outline-action" : ""}`}
          >
            <span className="font-display text-title">{table.label}</span>
            <span className="text-sm">{stateLabel[table.state]}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <article className="grid gap-4 rounded-2xl border-2 border-border bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-title">Mesa {selected.label}</h2>
            <StatusChip tone={stateTone[selected.state]}>
              {stateLabel[selected.state]}
            </StatusChip>
          </div>
          <p className="font-mono text-numeral">{cop(tableTotal(selected))}</p>
          <ul className="grid gap-2">
            {selected.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3">
                <span>
                  {line.name}
                  <span className="block text-sm text-ink-muted">
                    {line.sent ? "En cocina" : "Sin enviar"}
                  </span>
                </span>
                <span className="font-mono">{cop(line.priceCop)}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-2">
            {selected.state === "free" ? (
              <Button onClick={() => service.openTable(selected.id)}>
                Abrir cuenta
              </Button>
            ) : null}
            {selected.state === "occupied" || selected.state === "check" ? (
              <Button onClick={() => service.addLine(selected.id)}>
                Sumar producto
              </Button>
            ) : null}
            {selected.state === "occupied" ? (
              <Button
                variant="secondary"
                onClick={() => service.sendCourse(selected.id)}
              >
                Enviar fuego
              </Button>
            ) : null}
            {selected.state === "occupied" ? (
              <Button
                variant="secondary"
                onClick={() => service.requestCheck(selected.id)}
              >
                Imprimir precuenta
              </Button>
            ) : null}
            {selected.state === "check" || selected.state === "clean" ? (
              <Button onClick={() => service.markClean(selected.id)}>
                Mesa libre
              </Button>
            ) : null}
          </div>
          {selected.lines.some((line) => !line.sent) ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const pending = selected.lines.find((line) => !line.sent);
                if (pending) authorizeVoid(pending.id);
              }}
            >
              <label className="grid gap-2 text-base font-semibold" htmlFor="supervisor-pin">
                Anular lo que no se ha enviado
                <input
                  id="supervisor-pin"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  className="min-h-12 rounded-xl border-2 border-border px-4 font-mono"
                />
              </label>
              {pinError ? (
                <p role="alert" className="font-semibold text-danger">
                  {pinError}
                </p>
              ) : (
                <p className="text-ink-muted">Pide el PIN del supervisor.</p>
              )}
              <Button type="submit" variant="danger">
                Anular con PIN
              </Button>
            </form>
          ) : null}
        </article>
      ) : null}
      {service.notice ? (
        <p role="status" className="text-ink-muted">
          {service.notice}
        </p>
      ) : null}
    </section>
  );
}
