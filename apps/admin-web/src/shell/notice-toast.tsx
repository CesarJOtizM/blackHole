import styles from "#src/styles/notice.module.scss";

export function NoticeToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  if (message.length === 0) {
    return null;
  }

  return (
    <div className={styles.toast} role="status">
      <div className={styles.toastHead}>
        <p className={styles.toastLabel}>Listo</p>
        <button type="button" className={styles.toastClose} onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className={styles.toastBody}>{message}</p>
    </div>
  );
}
