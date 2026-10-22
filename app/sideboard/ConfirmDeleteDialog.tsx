"use client";

import { useEffect, useRef } from "react";
import styles from "./sideboard.module.css";

// Asks before a matchup is deleted. Closed when `name` is null.
export function ConfirmDeleteDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && name !== null && !dialog.open) {
      dialog.showModal();
    } else if (dialog && name === null && dialog.open) {
      dialog.close();
    }
  }, [name]);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-label="Delete matchup" onClose={onCancel}>
      <p>Delete “{name}”?</p>
      <div className={styles.dialogHead}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onConfirm}>
          Delete
        </button>
        <button type="button" className={styles.btn} onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
