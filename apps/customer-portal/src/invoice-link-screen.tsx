export function InvoiceLinkScreen({
  link,
  status,
}: {
  link: string;
  status: "in_process" | "ready";
}) {
  return (
    <main className="mx-auto grid min-h-svh max-w-lg gap-6 px-4 py-8">
      <header className="grid gap-1">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          {link}
        </p>
        <h1 className="font-display text-title">Factura</h1>
      </header>
      {status === "in_process" ? (
        <p role="status">In process</p>
      ) : (
        <a href={`/f/${link}/invoice.pdf`}>PDF</a>
      )}
    </main>
  );
}
