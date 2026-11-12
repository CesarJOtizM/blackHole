const WINDOW_MODES = ["same_day", "same_month", "off"] as const;

export type ReinvoiceWindowChoice = (typeof WINDOW_MODES)[number];

export function ReinvoiceWindowView({
  mode,
  permissions,
  onMode,
  onApprove,
}: {
  mode: ReinvoiceWindowChoice;
  permissions: readonly string[];
  onMode: (mode: ReinvoiceWindowChoice) => void;
  onApprove: () => void;
}) {
  const canApprove = permissions.includes("sale.credit-note");

  return (
    <section className="grid gap-4">
      <h1 className="font-display text-title">Ventana de refacturación</h1>
      <fieldset className="grid gap-2">
        <legend>Ventana</legend>
        {WINDOW_MODES.map((item) => (
          <label key={item} className="flex items-center gap-2">
            <input
              type="radio"
              name="reinvoice-window"
              value={item}
              checked={mode === item}
              onChange={() => onMode(item)}
            />
            {item}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={!canApprove}
        onClick={() => {
          if (canApprove) {
            onApprove();
          }
        }}
        className="min-h-12 rounded-xl bg-action px-4 text-action-ink disabled:opacity-50"
      >
        Aprobar nota crédito
      </button>
    </section>
  );
}
