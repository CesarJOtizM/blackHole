import { type InputHTMLAttributes, useId } from "react";
import ui from "#src/styles/ui.module.scss";

export function TextField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;

  return (
    <label className={ui.field} htmlFor={inputId}>
      <span className={ui.fieldLabel}>{label}</span>
      <input {...props} id={inputId} className={ui.input} />
    </label>
  );
}
