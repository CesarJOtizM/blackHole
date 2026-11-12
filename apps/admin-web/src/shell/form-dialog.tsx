import { type FormEvent, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "#src/styles/dialog.module.scss";

export interface DialogField {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}

const unsavedNotice =
  "Si cierras con cambios sin guardar, te pedimos confirmación.";

export function FormDialog({
  open,
  eyebrow,
  title,
  help,
  fields,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  help: string;
  fields: readonly DialogField[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const openedValues = useRef("");
  const wasOpen = useRef(false);
  const snapshot = fields.map((field) => field.value).join("\u0000");

  if (open && !wasOpen.current) {
    openedValues.current = snapshot;
  }
  wasOpen.current = open;

  const dirty = open && snapshot !== openedValues.current;
  const missingRequired = fields.some(
    (field) => field.required === true && field.value.trim().length === 0,
  );
  const dirtyRef = useRef(dirty);
  const onCloseRef = useRef(onClose);
  dirtyRef.current = dirty;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    firstField.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      dismiss();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function dismiss() {
    if (
      dirtyRef.current &&
      !window.confirm("Hay cambios sin guardar. ¿Cierras de todas formas?")
    ) {
      return;
    }
    onCloseRef.current();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (missingRequired) {
      return;
    }
    onSubmit();
  }

  return createPortal(
    <div className={styles.backdrop}>
      <button
        type="button"
        className={styles.scrim}
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={dismiss}
      />
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <button type="button" className={styles.close} onClick={dismiss}>
            Cerrar
          </button>
        </div>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.help}>{help}</p>
        {fields.map((field, index) => (
          <label key={field.label} className={styles.field}>
            <span className={styles.label}>
              {field.label}
              {field.required ? " · obligatorio" : ""}
            </span>
            <input
              ref={index === 0 ? firstField : undefined}
              className={styles.input}
              value={field.value}
              required={field.required}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </label>
        ))}
        <p className={styles.notice}>{unsavedNotice}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={dismiss}>
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submit}
            disabled={missingRequired}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
