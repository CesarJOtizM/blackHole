import { useId } from "react";
import ui from "#src/styles/ui.module.scss";

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
    <label className={ui.field} htmlFor={id}>
      <span className={ui.fieldLabel}>{label}</span>
      <select
        id={id}
        value={value}
        className={ui.select}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
