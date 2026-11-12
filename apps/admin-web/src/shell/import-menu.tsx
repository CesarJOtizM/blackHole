import { type ChangeEvent, useEffect, useRef, useState } from "react";
import styles from "#src/styles/notice.module.scss";
import ui from "#src/styles/ui.module.scss";

export function ImportMenu({
  pending = false,
  templateName,
  templateBody,
  onFile,
}: {
  pending?: boolean;
  templateName: string;
  templateBody: string;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onPointer(event: PointerEvent) {
      if (!wrap.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setOpen(false);
    if (file) {
      onFile(file);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([templateBody], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateName;
    link.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className={styles.menuWrap} ref={wrap}>
      <button
        type="button"
        className={ui.buttonGhost}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
        onClick={() => setOpen((current) => !current)}
      >
        Importar Excel
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => input.current?.click()}
          >
            Elegir archivo .xlsx
          </button>
          <button
            type="button"
            className={styles.menuItemMuted}
            role="menuitem"
            onClick={downloadTemplate}
          >
            Descargar plantilla
          </button>
        </div>
      ) : null}
      <input
        ref={input}
        className={styles.fileInput}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={chooseFile}
      />
    </div>
  );
}
