import { Button, Field } from "@blackhole/ui";
import { useState } from "react";
import { tableTotal, useService } from "#src/service/service-session.js";

const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

function cop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RegisterScreen() {
  const service = useService();
  const check = service.tables.find((table) => table.state === "check");
  const due = check ? tableTotal(check) : 0;
  const [cash, setCash] = useState("50000");
  const [card, setCard] = useState("48000");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [paid, setPaid] = useState(false);
  const [pendingQr, setPendingQr] = useState([
    { id: "intent_1", tableLabel: "06", summary: "Sopa · sitio $22.000" },
  ]);
  const [billingChoice, setBillingChoice] = useState<
    "portal" | "register" | null
  >(null);
  const counted = denominations.reduce(
    (sum, value) => sum + value * Number(counts[value] || 0),
    0,
  );
  const tendered = Number(cash || 0) + Number(card || 0);

  return (
    <section className="grid gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Caja 1 · Chapinero
        </p>
        <h1 className="font-display text-title">Turno de caja</h1>
      </header>
      <article className="grid gap-3">
        <h2 className="text-title">Apertura</h2>
        <p className="text-ink-muted">Base contada: {cop(200000)}</p>
        {service.shiftOpen ? (
          <p>Turno abierto.</p>
        ) : (
          <Button onClick={() => service.openShift()}>Abrir turno</Button>
        )}
      </article>
      <article className="grid gap-3">
        <h2 className="text-title">
          {check ? `Cobro mesa ${check.label}` : "Sin precuentas"}
        </h2>
        <p className="font-mono text-numeral">{cop(due)}</p>
        {check ? <p role="status">Datos recibidos</p> : null}
        <p role="status">
          Pago QR pendiente
          <span className="block">qrpay_stale</span>
        </p>
        {check ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setBillingChoice("portal")}
            >
              Usar datos del portal
            </Button>
            <Button
              variant="secondary"
              onClick={() => setBillingChoice("register")}
            >
              Usar datos de la caja
            </Button>
          </div>
        ) : null}
        <Field
          label="Efectivo"
          inputMode="numeric"
          value={cash}
          onChange={(event) => setCash(event.target.value)}
        />
        <Field
          label="Tarjeta · datáfono Bold · aprobación 4812"
          inputMode="numeric"
          value={card}
          onChange={(event) => setCard(event.target.value)}
        />
        <p className="text-ink-muted">
          Registrado {cop(tendered)}
          {tendered === due ? ". El cobro cuadra." : "."}
        </p>
        <Button
          disabled={
            !service.shiftOpen ||
            paid ||
            due === 0 ||
            tendered !== due ||
            (check !== undefined && billingChoice === null)
          }
          onClick={() => {
            setPaid(true);
            if (check) service.markClean(check.id);
          }}
        >
          Cobrar e imprimir factura
        </Button>
        {paid ? (
          <p role="status">
            Factura a consumidor final. El QR de la DIAN sale en el ticket. El
            cajón abre con el efectivo.
          </p>
        ) : null}
      </article>
      <article className="grid gap-3">
        <h2 className="text-title">Pedidos QR</h2>
        {pendingQr.length === 0 ? (
          <p className="text-ink-muted">Sin pedidos por aceptar.</p>
        ) : (
          pendingQr.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3"
            >
              <p>
                Mesa {order.tableLabel}
                <span className="block text-sm">QR table</span>
                <span className="block text-sm text-ink-muted">
                  {order.summary}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setPendingQr((current) =>
                      current.filter((item) => item.id !== order.id),
                    )
                  }
                >
                  Rechazar
                </Button>
                <Button
                  onClick={() =>
                    setPendingQr((current) =>
                      current.filter((item) => item.id !== order.id),
                    )
                  }
                >
                  Aceptar
                </Button>
              </div>
            </div>
          ))
        )}
      </article>
      <article className="grid gap-3">
        <h2 className="text-title">Propinas del turno</h2>
        <p className="text-ink-muted">
          Fondo común. Se reparte por igual entre quien marcó horas.
        </p>
        <Button variant="secondary" onClick={() => service.settleTips()}>
          Liquidar e imprimir
        </Button>
      </article>
      <article className="grid gap-3">
        <h2 className="text-title">Arqueo a ciegas</h2>
        <p className="text-ink-muted">
          Cuenta billetes y monedas antes de ver el esperado.
        </p>
        {denominations.map((value) => (
          <Field
            key={value}
            label={cop(value)}
            inputMode="numeric"
            value={counts[value] ?? ""}
            onChange={(event) =>
              setCounts((current) => ({
                ...current,
                [value]: event.target.value,
              }))
            }
          />
        ))}
        <p className="font-mono">Contado {cop(counted)}</p>
        <p>QR {cop(120_000)}</p>
        <p>Efectivo esperado {cop(200_000)}</p>
      </article>
      {service.notice ? (
        <p role="status" className="text-ink-muted">
          {service.notice}
        </p>
      ) : null}
    </section>
  );
}
