import { Button } from "@blackhole/ui";

export interface TablePaymentPart {
  partId: string;
  balanceCop: number;
  paid: boolean;
}

const money = (value: number): string =>
  `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;

const partNumber = (partId: string): string => partId.replace(/^part_/, "");

export function TablePaymentScreen({
  token,
  balanceCop,
  parts,
}: {
  token: string;
  balanceCop: number;
  parts: readonly TablePaymentPart[];
}) {
  const occupied = parts.some((part) => !part.paid);

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
              <Button type="button">
                Pagar parte {partNumber(part.partId)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
