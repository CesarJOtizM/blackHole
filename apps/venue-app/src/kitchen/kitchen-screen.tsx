import { Button } from "@blackhole/ui";
import { useService } from "#src/service/service-session.js";

export function KitchenScreen() {
  const service = useService();
  const open = service.tickets.filter((ticket) => !ticket.ready);
  const done = service.tickets.filter((ticket) => ticket.ready);

  return (
    <section className="grid gap-4 rounded-2xl bg-kitchen-surface p-4 text-kitchen-ink">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wide uppercase">
            Parrilla · Chapinero
          </p>
          <h1 className="font-display text-title">Cocina</h1>
        </div>
        <p className="font-mono text-numeral">{open.length}</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {open.map((ticket) => {
          const late = ticket.minutes >= 12;
          return (
            <article
              key={ticket.id}
              className={`grid gap-3 rounded-2xl border-2 p-4 ${late ? "border-kitchen-late" : "border-kitchen-ok"}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-title">
                  Mesa {ticket.tableLabel}
                  {ticket.id === "k-05" ? (
                    <span className="block font-mono text-xs uppercase">
                      QR table
                    </span>
                  ) : null}
                </h2>
                <p className={late ? "text-kitchen-late" : "text-kitchen-ok"}>
                  {ticket.minutes} min
                </p>
              </div>
              <p className="font-mono text-sm uppercase">{ticket.course}</p>
              <ul className="grid gap-1">
                {ticket.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Button onClick={() => service.markTicketReady(ticket.id)}>
                Listo
              </Button>
            </article>
          );
        })}
      </div>
      {done.length > 0 ? (
        <p className="text-kitchen-ok">
          Listos: {done.map((ticket) => `mesa ${ticket.tableLabel}`).join(", ")}
        </p>
      ) : null}
      {service.notice ? <p role="status">{service.notice}</p> : null}
    </section>
  );
}
