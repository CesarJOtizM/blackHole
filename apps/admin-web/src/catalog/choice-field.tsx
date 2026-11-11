import { useId } from "react";

interface Choice {
  value: string;
  label: string;
}

export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Choice[];
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-xl border-2 border-border bg-surface-raised px-4 text-body text-ink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
