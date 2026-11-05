import { type InputHTMLAttributes, useId } from "react";
import { joinClasses } from "#ui/join-classes.js";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    joinClasses(hint && hintId, error && errorId) || undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-base font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={joinClasses(
          "min-h-12 rounded-xl border-2 bg-surface-raised px-4 text-body text-ink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-action",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-base text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-base font-semibold text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
