"use client";

import { useEffect, useRef } from "react";
import styles from "./sideboard.module.css";

// Asks before something that can't be taken back. Closed when `message` is null.
export function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && message !== null && !dialog.open) {
      dialog.showModal();
    } else if (dialog && message === null && dialog.open) {
      dialog.close();
    }
  }, [message]);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-label="Confirm" onClose={onCancel}>
      <p>{message}</p>
      <div className={styles.dialogHead}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className={styles.btn} onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
