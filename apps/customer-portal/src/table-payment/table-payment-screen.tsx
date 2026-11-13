import { Button } from "@blackhole/ui";
import { useEffect, useState } from "react";

export interface TablePaymentPart {
  partId: string;
  balanceCop: number;
  paid: boolean;
}

const money = (value: number): string =>
  `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;

const partNumber = (partId: string): string => partId.replace(/^part_/, "");

const readBalance = (body: unknown): number | null => {
  if (
    typeof body === "object" &&
    body !== null &&
    "balanceCop" in body &&
    typeof body.balanceCop === "number"
  ) {
    return body.balanceCop;
  }

  return null;
};

export function TablePaymentRoute({ token }: { token: string }) {
  const [balanceCop, setBalanceCop] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void fetch(`/d/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return readBalance(await response.json());
      })
      .then((balance) => {
        if (!active) {
          return;
        }

        setBalanceCop(balance);
        setReady(true);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setReady(true);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!ready) {
    return <p role="status">Consultando el saldo.</p>;
  }

  if (balanceCop === null) {
    return <p role="status">Sin saldo para esta mesa.</p>;
  }

  return (
    <TablePaymentScreen token={token} balanceCop={balanceCop} parts={[]} />
  );
}

export function TablePaymentScreen({
  token,
  balanceCop,
  parts,
}: {
  token: string;
  balanceCop: number;
  parts: readonly TablePaymentPart[];
}) {
  const [notice, setNotice] = useState("");
  const occupied = parts.some((part) => !part.paid);

  function pay(partId?: string) {
    void fetch(`/d/${token}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        partId === undefined ? { tipCop: 0 } : { tipCop: 0, partId },
      ),
    })
      .then((response) => {
        setNotice(
          response.ok ? "Pago iniciado." : "No se pudo iniciar el pago.",
        );
      })
      .catch(() => {
        setNotice("No se pudo iniciar el pago.");
      });
  }

  return (
    <main className="mx-auto grid min-h-svh max-w-lg gap-6 px-4 py-8">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          Mesa {token}
        </p>
        <h1 className="font-display text-title">Pagar la mesa</h1>
        <p className="font-mono text-numeral">{money(balanceCop)}</p>
      </header>
      {occupied ? <p role="status">La mesa sigue ocupada.</p> : null}
      <ul className="grid gap-3">
        {parts.map((part) => (
          <li
            key={part.partId}
            className="flex items-center justify-between gap-3"
          >
            <p>
              Parte {partNumber(part.partId)}
              <span className="block">{money(part.balanceCop)}</span>
            </p>
            {part.paid ? (
              <p>Pagada</p>
            ) : (
              <Button type="button" onClick={() => pay(part.partId)}>
                Pagar parte {partNumber(part.partId)}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {parts.length === 0 ? (
        <Button type="button" onClick={() => pay()}>
          Pagar la cuenta
        </Button>
      ) : null}
      {notice.length > 0 ? <p role="status">{notice}</p> : null}
    </main>
  );
}
